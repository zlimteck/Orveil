const mongoose = require('mongoose');

function buildUri() {
  if (process.env.MONGODB_URI) {
    // Si l'URI est fournie directement, on encode les credentials si nécessaire
    const uri = process.env.MONGODB_URI;
    // Détecter le cas password@host@host (@ dans le mot de passe non encodé)
    // On reconstruit depuis les variables individuelles si disponibles
    const user = process.env.MONGO_USER;
    const pass = process.env.MONGO_PASS;
    const host = process.env.MONGO_HOST || 'mongodb';
    const port = process.env.MONGO_PORT || '27017';
    const db   = process.env.MONGO_DB   || 'notifhub';

    if (user && pass) {
      return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}?authSource=admin`;
    }
    return uri;
  }
  return 'mongodb://localhost:27017/notifhub';
}

async function connectDB() {
  const uri = buildUri();
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connecté');
  } catch (err) {
    console.error('Erreur MongoDB:', err.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
