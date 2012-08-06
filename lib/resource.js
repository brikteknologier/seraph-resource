var _ = require('underscore');
var Controller = require('controller');
var join = require('path').join;

module.exports = function(model, options) {
  options = _.extend({
    root: '/'
  }, options || {});

  var controller = Controller({ prefix: options.root });
  var root = join('/', options.root, model.type);

  controller.define('read', function(req, res) {
    res.contentType('application/json');
    var id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.send(400);
    }

    model.db.read(id, function(err, node) {
      if (err) {
        return res.send(err.message, 500);
      }

      res.send(JSON.stringify(node));
    });
  });

  controller.define('create', ['mutators'], function(req, res) {
    res.contentType('application/json');
    model.save(req.body, function(err, node) {
      if (err) {
        return res.send(err.message || err, 500);
      }

      res.send(JSON.stringify(node), 201);
    });
  });

  controller.define('update', ['mutators'], function(req, res) {
    res.contentType('application/json');
    if (req.params.id != null && req.body.id == null) {
      req.body.id = req.params.id;
    }
    model.save(req.body, function(err, node) {
      if (err) {
        return res.send(err.message || err, 500);
      }

      res.send(JSON.stringify(node), 200);
    });
  });

  controller.define('delete', ['mutators'], function(req, res) {
    res.contentType('application/json');
    var id = req.params.id == null ? req.body.id : req.params.id;
    model.db.delete(id, function(err, node) {
      if (err) {
        return res.send(err.message || err, 500);
      }

      res.send(200);
    });
  });

  controller.route('get', root, 'read');
  controller.route('put', join(root, ':id?'), 'update');
  controller.route('post', root, 'create');
  controller.route('delete', join(root, ':id?'), 'delete');

  return controller;
}