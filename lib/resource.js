var _ = require('underscore');
var Controller = require('controller');
var express = require('express');
var join = require('path').join;
var naan = require('naan');

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

    model.db.read(id, function(err, node) {
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
      if (err)  return res.send(err.message || err, 500);
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
        if (err) req.send(err.message || err,  rels);
        else res.json(rels);
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

  controller.get(join(root, param), 'read');
  controller.put(join(root, ':_id?'), 'update');
  controller.post(root, 'create');
  controller.delete(join(root, ':_id?'), 'delete');

  controller.get(join(root, ':_id', 'rel', ':_type', ':_direction?'), 'rel:read');
  controller.post(join(root, ':_from', 'rel', ':_type', ':_to'), 'rel:create');

  return controller;
}