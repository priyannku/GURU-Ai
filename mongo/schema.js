import { model, Schema } from "mongoose";

// Define the schema
const schema = new Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
  },

  session: String,
});

// Create the session schema model
const sessionSchema = model("sessionschemas", schema);

// Export the Database class
export default class Database {
  constructor() {
    this.session = sessionSchema;
  }

  /**
   * @param {string} sessionId
   * @returns {Promise<{sessionId: string, session: string}>}
   */
  getSession = async (sessionId) => await this.session.findOne({ sessionId });
}
