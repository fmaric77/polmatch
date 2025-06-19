// Central MongoDB connection string for the app
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

export default MONGODB_URI as string;
