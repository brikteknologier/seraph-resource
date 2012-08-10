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
      res.end("Invalid ID", 400);
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

  controller.define('read', ['accessors'], function(req, res) {
    res.json(req[model.type]);
  });

  controller.define('create', ['accessors', 'mutators'], function(req, res) {
    model.save(req.body, function(err, node) {
      if (err)  return res.send(err.message || err, 500);
      else res.json(node, 201);
    });
  });

  controller.define('update', ['accessors', 'mutators'], function(req, res) {
    if (req.params.id != null && req.body.id == null) {
      req.body.id = req.params.id;
    }
    model.save(req.body, function(err, node) {
      if (err) res.send(err.message || err, 500);
      else res.json(node);
    });
  });

  controller.define('delete', ['mutators'], function(req, res) {
    var id = req.params.id == null ? req.body.id : req.params.id;
    model.db.delete(id, function(err, node) {
      if (err) res.send(err.message || err, 500);
      else res.send(200);
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
  controller.put(join(root, ':id?'), 'update');
  controller.post(root, 'create');
  controller.delete(join(root, ':id?'), 'delete');

  return controller;
}