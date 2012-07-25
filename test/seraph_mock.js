var _ = require('underscore');

function SeraphMock() {
  var db = [];
  var idx = {};
  this.save = function(obj, cb) {
    if (obj.id != null) {
      db[obj.id] = obj;
    } else {
      obj = _.extend({}, obj, {id: db.length});
      db.push(obj);
    }
    cb(null, obj);
  }
  this.index = function(idxk, obj, k, v, cb) {
    idx[idxk] = idx[idxk] || {};
    idx[idxk][k] = idx[idxk][k] || {};
    idx[idxk][k][v] = idx[idxk][k][v] || [];
    idx[idxk][k][v].push(obj);
    cb();
  }
  this.read = function(i, cb) {
    if (i < 0 || i >= db.length) {
      return cb(new Error('Invalid ID'));
    } else {
      cb(null, db[i]);
    }
  }
  this.index.read = function(idxk, k, v, cb) {
    if (!idx[idxk] || !idx[idxk][k] || !idx[idxk][k][v]) {
      cb(null, []);
    } else {
      cb(null, idx[idxk][k][v]);
    }
  }
  this.delete = function(obj, cb) {
    var id = obj.id == null ? obj : obj.id;
    db = db.slice(0, id).concat(db.slice(id + 1));
    cb();
  }
}

module.exports = SeraphMock;