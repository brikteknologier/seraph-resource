var _ = require('underscore');
var Controller = require('controller');
var join = require('path').join;

module.exports = function(model, options) {
  options = _.extend({
    root: '/'
  }, options || {});

  var controller = Controller({ prefix: options.root });
  var root = join('/', model.type);


  var _attach = controller.attach;
  controller.attach = function(app) {
    app.param(model.type, function(req, res, next, id) {
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
    });
    _attach.call(controller, app);
  }

  controller.define('read', ['accessors'], function(req, res) {
    res.json(req[model.type]);
  });


  controller.define('create', ['accessors', 'mutators'], function(req, res) {
    model.save(req.body, function(err, node) {
      if (err) {
        return res.send(err.message || err, 500);
      }

      res.json(node, 201);
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
          if (fieldValue == null) {
            res.send(404);
          } else {
            res.json(fieldValue);
          }
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

      controller.route('get', join(root, param, field), 'read:' + field);
      controller.route('post', join(root, param, field), 'create:' + field);
      controller.route('put', join(root, param, field), 'update:' + field);
      controller.route('delete', join(root, param, field), 'delete:' + field);
    });
  }

  controller.route('get', join(root, param), 'read');
  controller.route('put', join(root, ':id?'), 'update');
  controller.route('post', root, 'create');
  controller.route('delete', join(root, ':id?'), 'delete');

  return controller;
}