var underscore = require('underscore');
var path = require('path');

module.exports = function(app, model, options) {
  options = _.extend({
    root: '/'
  });

  var root = path.join('/', options.root, model.type);

  app.get(path.join(root, ':id'), function(req, res) {
    var id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.send(400);
    }

    model.db.read(id, function(err, node) {
      if (err) {
        return res.send(err.message, 500);
      }

      res.contentType('application/json');
      res.send(JSON.stringify(node));
    });
  });

  app.post(path.join())
}