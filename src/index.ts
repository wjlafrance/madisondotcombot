import Snoowrap, { Submission, Subreddit } from "snoowrap";
import https from "https";
import { convert } from "html-to-text";
import sqlite3 from "sqlite3";
import { open } from 'sqlite';
import * as readline from "readline";
import moment from "moment";

require("dotenv").config();

const r = new Snoowrap({
  userAgent: "madisondotcombot v0.1",
  clientId: "I0TVgcoDscZxjy9wqyTG6w",
  clientSecret: process.env.clientSecret,
  username: process.env.username,
  password: process.env.password
});

export async function MadisonDotComBot() {

  let rl = readline.createInterface({input: process.stdin, output: process.stdout});

  const database = await open({
    filename: "state.db",
    driver: sqlite3.Database
  });
  await database.exec("CREATE TABLE IF NOT EXISTS seen_posts (id TEXT)");

  async function hasSeenSubmission(submission: Snoowrap.Submission): Promise<boolean> {
    const result = await database.get('SELECT COUNT(id) FROM seen_posts WHERE id = ?', [submission.id]);
    return result["COUNT(id)"] as number > 0;
  }

  async function markSeenSubmission(submission: Snoowrap.Submission): Promise<void> {
    return database.run("INSERT INTO seen_posts (id) VALUES (?)", [submission.id]).then((result) => {
      if (result.changes != 1) {
        throw new Error("Expected one change marking submission as seen.");
      }
    });
  }

  async function fetchArticle(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = https.request(url, (result) => {
        var data = '';
        result.on('data', (chunk) => {
          data += chunk;
        });
        result.on('end', () => {
          // console.log(data);
          resolve(convert(data, {
            baseElements: { selectors: [
              "div.lee-article-text"
            ]},
            ignoreHref: true
          }));
        });
      });
      request.on('error', reject);
      request.end();
    });
  }

  r.getSubreddit("madisonwi").search({query:'site:"madison.com"'}).then(async (submissions) => {
    let sortedSubmissions = submissions.sort((lhs, rhs) => {
      // newest first
      return rhs.created - lhs.created;
    }).filter((submission) => {
      return submission.created > moment().subtract(2, "days").unix();
    });

    // print all submissions
    sortedSubmissions.forEach((submission: Snoowrap.Submission, index: number) => {
      console.log(index, submission.id, new Date(submission.created * 1000), submission.title);
    });

    // this promise is added onto through the following loop
    var bigpromise = new Promise<void>((resolve, reject) => {
      resolve();
    });

    sortedSubmissions.forEach(async (submission: Snoowrap.Submission, index: number) => {

      if (await hasSeenSubmission(submission)) {
        bigpromise = bigpromise.then(() => {
          console.log("Already marked", submission.id, "as read. Skipping.");
        });
        return;
      }

      bigpromise = bigpromise.then(() => {
        console.log("Never seen before", `https://reddit.com/${submission.id}`, new Date(submission.created * 1000), "\n", submission.url);

        return new Promise<string>((resolve, reject) => {
          rl.question("Fetch?", resolve);
        });

      }).then(() => {
        return fetchArticle(submission.url)

      }).then((content: string) => {
        let purified = content.split(/\r?\n/).filter((line) => {
          return !line.match(/^-+$/) // eliminate long dashed line at the bottom
        }).map((line) => `> ${line}`).join("\n");
        purified += "\n\n^(I am a very new bot. Sorry if I misbehave. Please consider supporting local journalism.)"

        console.log(purified);
        return new Promise<string>((resolve, reject) => {
          rl.question("Post?", (answer) => resolve(purified));
        });

      }).then((content: string) => {
        return submission.reply(content)

      }).then(() => {
        return new Promise<string>((resolve, reject) => {
          rl.question("Mark as seen?", resolve);
        })

      }).then(() => {
        markSeenSubmission(submission)

      }).then(() => {
        console.log(`Marked ${submission.id} as seen.`);
      });

      return bigpromise;
    });
  });

}

MadisonDotComBot();
