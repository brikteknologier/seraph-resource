var _ = require('underscore');

function SeraphMock() {
  var db = [];
  var rels = [];
  var idx = {};
  this.options = {id:'id'};
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
  this.relationships = function(obj, dir, type, cb) {
    var id = obj.id == null ? obj : obj.id;
    cb(null, _.filter(rels, function(rel) {
      if (rel.type != type) return false;
      else if (dir === 'in') return rel.to == id;
      else if (dir === 'out') return rel.from == id;
      else return id == rel.from || id == rel.to;
    }));
  }
  this.relate = function(from, type, to, props, cb) {
    var rel = {
      from: from,
      to: to,
      properties: props,
      type: type,
      id: rels.length
    };
    rels.push(rel);
    cb(null, rel);
  }
}

module.exports = SeraphMock;