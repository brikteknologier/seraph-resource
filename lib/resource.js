var _ = require('underscore');
var Controller = require('controller');
var express = require('express');
var join = require('path').join;
var naan = require('naan');
var async = require('async');

var parser = naan.curry(express.bodyParser, { strict: false });

module.exports = function(model) {
  var controller = Controller();
  var root = join('/', model.type);

  controller.app.use(parser());
  controller.param = function(req, res, next, id) {
    id = parseInt(id, 10);
    if (isNaN(id)) {
      return next();
    }

    model.read(id, function(err, node) {
      if (err) {
        res.send(err.message, 404);
      } else {
        req[model.type] = node;
        next();
      }
    })
  };
  controller.app.param(model.type, controller.param);


  // Node CRUD
  controller.define('read', ['accessors'], function(req, res, next) {
    if (req[model.type] != null) res.json(req[model.type]);
    else next();
  });

  controller.define('create', ['accessors', 'mutators'], function(req, res) {
    model.save(req.body, function(err, node) {
      if (err)  return res.send(err.message || err, err.statusCode || 500);
      else res.json(node, 201);
    });
  });

  controller.define('update', ['accessors', 'mutators'], function(req, res) {
    if (req.params._id != null && req.body.id == null) {
      req.body.id = req.params._id;
    }
    model.save(req.body, function(err, node) {
      if (err) res.send(err.message || err, 500);
      else res.json(node);
    });
  });

  controller.define('delete', ['mutators'], function(req, res) {
    var id = req.params._id == null ? req.body.id : req.params._id;
    model.db.delete(id, function(err, node) {
      if (err) res.send(err.message || err, 500);
      else res.send(200);
    });
  });

  // Relationship CR
  controller.define('rel:read', ['accessors', 'relationships'], 
  function(req, res) {
    req.params._id = parseInt(req.params._id, 10);
    if (req.params._type == null || isNaN(req.params._id)) {
      return req.send(400);
    }
    req.params._direction = req.params._direction || 'all';
    model.db.relationships(req.params._id, 
      req.params._direction, req.params._type, function(err, rels) {
        if (err) req.send(err.message || err, 500);
        else res.json(rels);
      });
  });

  controller.define('rel:nodes', ['accessors', 'relationships'],
  function(req, res) {
    req.params._id = parseInt(req.params._id, 10);
    if (req.params._type == null || isNaN(req.params._id)) {
      return req.send(400);
    }
    req.params._direction = req.params._direction || 'all';
    model.db.relationships(req.params._id,
      req.params._direction, req.params._type, function(err, rels) {
        if (err) return req.send(err.message || err, 500);
        var nodes = rels.map(function(rel) {
          return rel.start == req.params._id ? rel.end : rel.start;
        });
        async.map(nodes, model.db.read, function(err, nodes) {
          if (err) return req.send(err.message || err, 500);
          res.json(nodes);
        });
      });
  });

  controller.define('rel:create', 
    [ 'accessors', 
      'mutators', 
      'relationships' ], 
  function(req, res) {
    var params = req.params;
    params.from = parseInt(params._from, 10);
    params.to = parseInt(params._to, 10);
    if (params._type == null || isNaN(params._from) || isNaN(params._to)) {
      return req.send(400);
    }
    model.db.relate(params._from, params._type, params._to, req.body,
    function(err, rel) {
      if (err) res.send(err.message || err, 500);
      else res.json(rel);
    });
  });

  var param = ':' + model.type;

  if (Array.isArray(model.fields)) {
    model.fields.forEach(function(field) {
      controller.define('read:' + field, 
        [ 'accessors',
          'properties' ], 
        function(req, res) {
          var fieldValue = req[model.type][field];
          if (fieldValue == null) res.send(404);
          else res.json(fieldValue);
        });

      controller.define('create:' + field, 
        [ 'accessors', 
          'mutators',
          'properties' ], 
        function(req, res) {
          if (req[model.type][field] != null) {
            res.send('Property already exists', 409);
          } else {
            req[model.type][field] = req.body;
            model.save(req[model.type], function(err, node) {
              if (err) res.send(err.message || err, 500);
              else res.json(node, 201);
            });
          }
        });

      controller.define('update:' + field,
        [ 'accessors', 
          'mutators',
          'properties' ], 
        function(req, res) {
          req[model.type][field] = req.body;
          model.save(req[model.type], function(err, node) {
            if (err) res.send(err.message || err, 500);
            else res.json(node);
          })
        });

      controller.define('delete:' + field,
        [ 'accessors', 
          'mutators',
          'properties' ], 
        function(req, res) {
          delete req[model.type][field];
          model.save(req[model.type], function(err, node) {
            if (err) res.send(err.message || err, 500);
            else res.json(node);
          })
        });

      controller.get(join(root, param, field), 'read:' + field);
      controller.post(join(root, param, field), 'create:' + field);
      controller.put(join(root, param, field), 'update:' + field);
      controller.delete(join(root, param, field), 'delete:' + field);
    });
  }

  Object.keys(model.compositions).forEach(function(comp) {
    comp = model.compositions[comp];
    controller.define('read:' + comp.name,
      [ 'accessors',
        'compositions' ],
      function(req, res) {
        if (req.params._id == null) return res.send(400, "Invalid ID");
        var id = req.params._id;
        model.readComposition(id, comp.name, function(err, comps) {
          if (err) return res.send(500, err.message || err);
          res.json(comps);
        })
      });

    controller.define('push:' + comp.name,
      [ 'accessors',
        'mutators',
        'compositions' ],
      function(req, res) {
        if (req.params._id == null) return res.send(400, "Invalid ID");
        var id = req.params._id;
        
        // this is a shabby way of implementation. The proper way would be to
        // implement a function on seraph-model which can push to a composition.
        // we should add that in the future. for now this will pass the test.
        model.read(id, function(err, object) {
          if (err) return res.send(err.statusCode || 500, err.message || err);
          if (!object[comp.name]) object[comp.name] = req.body;
          else if (Array.isArray(object[comp.name]))
            object[comp.name].push(req.body);
          else 
            object[comp.name] = [object[comp.name], req.body];

          model.save(object, function(err, object) {
            if (err) return res.send(err.statusCode || 500, err.message || err);
            res.json(object[comp.name]);
          });
        });
      });

    controller.get(join(root, ':_id', comp.name), 'read:' + comp.name);
    controller.post(join(root, ':_id', comp.name), 'push:' + comp.name);
  });

  controller.get(join(root, param), 'read');
  controller.put(join(root, ':_id?'), 'update');
  controller.post(root, 'create');
  controller.delete(join(root, ':_id?'), 'delete');

  controller.get(join(root, ':_id', 'rel', ':_type', ':_direction?'), 'rel:read');
  controller.post(join(root, ':_from', 'rel', ':_type', ':_to'), 'rel:create');
  controller.get(join(root, ':_id', 'rel', ':_type', ':_direction?', 'nodes'), 'rel:nodes');

  return controller;
}
