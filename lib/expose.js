var _ = require('underscore');
var path = require('path');

module.exports = function(app, model, options) {
  options = _.extend({
    root: '/'
  }, options || {});

  var root = path.join('/', options.root, model.type);

  app.get(path.join(root, ':id'), function(req, res) {
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

  app.post(root, function(req, res) {
    res.contentType('application/json');
    model.save(req.body, function(err, node) {
      if (err) {
        return res.send(err.message || err, 500);
      }

      res.send(JSON.stringify(node), 201);
    });
  });

  app.put(path.join(root, ':id?'), function(req, res) {
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

  app.delete(path.join(root, ':id?'), function(req, res) {
    res.contentType('application/json');
    var id = req.params.id == null ? req.body.id : req.params.id;
    model.db.delete(id, function(err, node) {
      if (err) {
        return res.send(err.message || err, 500);
      }

      res.send(200);
    });
  });
}