import { initAuthCreds, BufferJSON } from "@whiskeysockets/baileys";
import proto from "@whiskeysockets/baileys";
import Database from "./schema.js";
import mongoose from "mongoose";

export default class Authentication {
  /**
   * @param {string} sessionId
   */
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.DB = new Database();
  }

  /**
   * Connects to the database with improved error handling and configuration options.
   * @param {string} uri - MongoDB connection URI.
   * @param {Object} options - Additional connection options.
   * @returns {Promise<mongoose.Connection>}
   */
  static async connectDB(uri, options = {}) {
    const defaultOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, 
    };

    const connectionOptions = { ...defaultOptions, ...options };

    try {
      await mongoose.connect(uri, connectionOptions);
      console.log("Database connection established successfully.");
      
      mongoose.connection.on('error', (error) => {
        console.error('Database connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('Database disconnected. Attempting to reconnect...');
        setTimeout(() => Authentication.connectDB(uri, options), 5000);
      });

      return mongoose.connection;
    } catch (error) {
      console.error("Error connecting to the database:", error);
      throw error;
    }
  }

  /**
   * Retrieves authentication credentials from the database.
   * @returns {Promise<Object>} - Auth state with saveState and clearState functions.
   */
  getAuthFromDatabase = async () => {
    let creds;
    let keys = {};
    const storedCreds = await this.DB.getSession(this.sessionId);
    if (storedCreds !== null && storedCreds.session) {
      const parsedCreds = JSON.parse(storedCreds.session, BufferJSON.reviver);
      creds = parsedCreds.creds;
      keys = parsedCreds.keys;
    } else {
      if (storedCreds === null) {
        await new this.DB.session({
          sessionId: this.sessionId,
        }).save();
      }
      creds = initAuthCreds();
    }

    const saveState = async () => {
      const session = JSON.stringify(
        {
          creds,
          keys,
        },
        BufferJSON.replacer,
        2
      );
      await this.DB.session.updateOne(
        { sessionId: this.sessionId },
        { $set: { session } }
      );
    };

    const clearState = async () => {
      await this.DB.session.deleteOne({ sessionId: this.sessionId });
    };

    return {
      state: {
        creds,
        keys: {
          get: (type, ids) => {
            const key = this.KEY_MAP[type];
            return ids.reduce((dict, id) => {
              let value = keys[key]?.[id];
              if (value) {
                if (type === "app-state-sync-key") {
                  value = proto.AppStateSyncKeyData.fromObject(value);
                }
                dict[id] = value;
              }
              return dict;
            }, {});
          },
          set: (data) => {
            for (const _key in data) {
              const key = this.KEY_MAP[_key];
              keys[key] = keys[key] || {};
              Object.assign(keys[key], data[_key]);
            }
            saveState();
          },
        },
      },
      saveState,
      clearState,
    };
  };

  /**
   * Closes the database connection.
   * @returns {Promise<void>}
   */
  static async closeConnection() {
    try {
      await mongoose.connection.close();
      console.log("Database connection closed successfully.");
    } catch (error) {
      console.error("Error closing database connection:", error);
      throw error;
    }
  }

  /**@private */
  KEY_MAP = {
    "pre-key": "preKeys",
    session: "sessions",
    "sender-key": "senderKeys",
    "app-state-sync-key": "appStateSyncKeys",
    "app-state-sync-version": "appStateVersions",
    "sender-key-memory": "senderKeyMemory",
  };
}