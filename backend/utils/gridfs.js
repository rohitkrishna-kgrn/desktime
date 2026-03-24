const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

let bucket = null;

function getBucket() {
  if (!bucket) {
    bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'screenshots' });
  }
  return bucket;
}

function resetBucket() {
  bucket = null;
}

module.exports = { getBucket, resetBucket };
