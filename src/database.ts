import sqlite3 from "sqlite3";
import { Database, open } from 'sqlite';

import Snoowrap, { Submission, Subreddit } from "snoowrap";

export class DatabaseAccess {
  database: Database<sqlite3.Database, sqlite3.Statement>;

  constructor(database: Database<sqlite3.Database, sqlite3.Statement>) {
    this.database = database;

    database.exec("CREATE TABLE IF NOT EXISTS seen_posts (id TEXT)");
  }

  static async get(): Promise<DatabaseAccess> {
    return new DatabaseAccess(await open({
      filename: "state.db",
      driver: sqlite3.Database
    }));
  }

  async hasSeenSubmission(submission: Snoowrap.Submission): Promise<boolean> {
    const result = await this.database.get('SELECT COUNT(id) FROM seen_posts WHERE id = ?', [submission.id]);
    return result["COUNT(id)"] as number > 0;
  }

  async markSeenSubmission(submission: Snoowrap.Submission): Promise<void> {
    const result = await this.database.run("INSERT INTO seen_posts (id) VALUES (?)", [submission.id]);
    if (result.changes != 1) {
      throw new Error("Expected one change marking submission as seen.");
    }
  }
}
