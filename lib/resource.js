var _ = require('underscore');
var Controller = require('controller');
var express = require('express');
var join = require('path').join;
var naan = require('naan');
var async = require('async');

var parserJson = naan.curry(express.json, { strict: false });
var parserUrlEncoded = naan.curry(express.urlencoded, { strict: false });

module.exports = function(model, opts) {
  var controller = Controller();
  var root = join('/', model.type);

  opts = _.extend({
    strictContentType: true,
    relRoutes: false
  },  opts || {});

  controller.app.use(parserJson());
  controller.app.use(parserUrlEncoded());

  controller.param = function(req, res, next, id) {
    id = parseInt(id, 10);
    if (isNaN(id)) {
      return next();
    }

    model.read(id, function(err, node) {
      if (err) {
        res.json(err.statusCode || 500, err.message || err);
      } else {
        req[model.type] = node;
        next();
      }
    })
  };
  controller.app.param(model.type, controller.param);

  function checkAccess(permission, paramName) {
    return function(req, res, next) {
      if (!controller.checkAccess) return next();

      function checkResult(err, hasAccess) {
        if (err) return next(err);
        if (!hasAccess) {
          res.send(401);
        } else {
          next();
        }
      }

      if (paramName) {
        var id = parseInt(req.params[paramName], 10);
        if (isNaN(id)) return next();
        controller.checkAccess(req, permission, id, checkResult);
      } else {
        controller.checkAccess(req, permission, null, checkResult);
      }
    }
  }

  // Group middleware
  controller.middleware('mutators', function(req, res, next) {
    if (!opts.strictContentType) return next();
    if (typeof req.body == "object" && req.body !== null && Object.keys(req.body) == 0) // req.body == {}
      return next();
    if (!req.headers['content-type'].match(/application\/json/i))
      return res.json(415, "Data must be sent as application/json");
    next();
  });
  
  // Node CRUD
  controller.define(
    'read', [checkAccess('r', model.type)], 
    function(req, res, next) {
      if (req[model.type] === false) return res.send(404);
      if (req[model.type] != null) res.json(req[model.type]);
      else next();
    });

  controller.define(
    'create', ['mutators', checkAccess('w')], 
    function(req, res) {
      model.save(req.body, function(err, node) {
        if (err)  return res.json(err.statusCode || 500, err.message || err);
        else res.json(201, node);
      });
    });

  controller.define(
    'update', ['mutators', checkAccess('w', '_id')], 
    function(req, res) {
      if (req.params._id != null && req.body.id == null) {
        req.body.id = req.params._id;
      }
      model.save(req.body, function(err, node) {
        if (err) res.json(err.statusCode || 500, err.message || err);
        else res.json(node);
      });
    });

  controller.define(
    'update-root', ['mutators', checkAccess('w', '_id')], 
    function(req, res) {
      if (req.params._id != null && req.body.id == null) {
        req.body.id = req.params._id;
      }
      model.save(req.body, true, function(err, node) {
        if (err) res.json(err.statusCode || 500, err.message || err);
        else res.json(node);
      });
    });

  controller.define(
    'delete', ['mutators', checkAccess('w', '_id')], 
    function(req, res) {
      var id = req.params._id == null ? req.body.id : req.params._id;
      model.db.delete(id, true, function(err, node) {
        if (err) res.json(err.statusCode || 500, err.message || err);
        else res.send(200);
      });
    });

  // Relationship CR
  controller.define('rel:read', ['relationships'], 
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

  controller.define('rel:nodes', ['relationships'],
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
    [ 'mutators', 
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
      if (err) res.json(err.statusCode || 500, err.message || err);
      else res.json(rel);
    });
  });

  var param = ':' + model.type;

  if (Array.isArray(model.fields)) {
    model.fields.forEach(function(field) {
      controller.define('read:' + field, 
        [ 'properties', checkAccess('r', '_id') ], 
        function(req, res) {
          req.params._id = parseInt(req.params._id, 10);
          if (isNaN(req.params._id)) return req.send(400, 'Invalid ID');
          model.db.read(req.params._id, field, function(err, value) {
            if (err) res.json(err.statusCode || 500, err.message || err);
            else res.json(value);
          });
        });

      function saveOrUpdate(req, res) {
        req.params._id = parseInt(req.params._id, 10);
        if (isNaN(req.params._id)) return req.send(400, 'Invalid ID');
        model.db.save(req.params._id, field, req.body, function(err) {
          if (err) res.json(err.statusCode || 500, err.message || err);
          else res.send(204);
        });
      };

      controller.define('create:' + field, 
        [ 'mutators',
          'properties',
          checkAccess('w', '_id') ], 
        saveOrUpdate);

      controller.define('update:' + field,
        [ 'mutators',
          'properties', 
          checkAccess('w', '_id') ], 
        saveOrUpdate);

      controller.define('delete:' + field,
        [ 'mutators',
          'properties', 
          checkAccess('w', '_id') ], 
        function(req, res) {
          req.params._id = parseInt(req.params._id, 10);
          if (isNaN(req.params._id)) return req.send(400, 'Invalid ID');
          model.db.delete(req.params._id, field, function(err, node) {
            if (err) res.json(err.statusCode || 500, err.message || err);
            else res.send(204);
          })
        });

      controller.get(join(root, ':_id', field), 'read:' + field);
      controller.post(join(root, ':_id', field), 'create:' + field);
      controller.put(join(root, ':_id', field), 'update:' + field);
      controller.delete(join(root, ':_id', field), 'delete:' + field);
    });
  }

  Object.keys(model.compositions).forEach(function(comp) {
    comp = model.compositions[comp];
    controller.define('read:' + comp.name,
      [ 'compositions', 
        checkAccess('r', '_id') ],
      function(req, res) {
        if (req.params._id == null) return res.json(400, "Invalid ID");
        var id = req.params._id;
        model.readComposition(id, comp.name, function(err, comps) {
          if (err) return res.json(err.statusCode || 500, err.message || err);
          res.json(comps);
        })
      });

    controller.define('push:' + comp.name,
      [ 'mutators',
        'compositions',
        checkAccess('w', '_id') ],
      function(req, res) {
        if (req.params._id == null) return res.json(400, "Invalid ID");
        var id = req.params._id;
        
        model.push(id, comp.name, req.body, function(err, result) {
          if (err) res.json(err.statusCode || 500, err.message || err);
          else res.json(201, result);
        });
      });

    controller.define('update:' + comp.name,
      [ 'mutators',
        'compositions',
        checkAccess('w', '_id') ],
      function(req, res) {
        if (req.params._id == null) return res.json(400, "Invalid ID");
        var id = req.params._id;
        
        model.saveComposition(id, comp.name, req.body, function(err, result) {
          if (err) res.json(err.statusCode || 500, err.message || err);
          else res.json(200, result);
        });
      });

    controller.get(join(root, ':_id', comp.name), 'read:' + comp.name);
    controller.post(join(root, ':_id', comp.name), 'push:' + comp.name);
    controller.put(join(root, ':_id', comp.name), 'update:' + comp.name);
  });

  controller.get(join(root, param), 'read');
  controller.put(join(root, ':_id?'), 'update');
  controller.put(join(root, 'root', ':_id?'), 'update-root');
  controller.post(root, 'create');
  controller.delete(join(root, ':_id?'), 'delete');

  if (opts.relRoutes) {
    controller.get(join(root, ':_id', 'rel', ':_type', ':_direction?'), 'rel:read');
    controller.post(join(root, ':_from', 'rel', ':_type', ':_to'), 'rel:create');
    controller.get(join(root, ':_id', 'rel', ':_type', ':_direction?', 'nodes'), 'rel:nodes');
  }

  return controller;
}
