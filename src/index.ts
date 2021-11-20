import Snoowrap from "snoowrap";
import https from "https";
import { convert as convertHtmlToText } from "html-to-text";
import moment from "moment";

import { DatabaseAccess } from "./database"

import dotenv from "dotenv";
dotenv.config();

const r = new Snoowrap({
  userAgent: "madisondotcombot v0.1",
  clientId: "I0TVgcoDscZxjy9wqyTG6w",
  clientSecret: process.env.clientSecret,
  username: process.env.username,
  password: process.env.password
});

const dryRun = false;

async function prepareArticle(url: string): Promise<string> {

  async function loadHttps(url: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const request = https.request(url, (result) => {
        let data = '';
        result.on('data', chunk => data += chunk );
        result.on('end', () => resolve(data));
      });
      request.on('error', reject);
      request.end();
    })
  }

  const html = await loadHttps(url);
  const text = convertHtmlToText(html, {
    baseElements: {
      selectors: [
        "div.lee-article-text"
      ]
    },
    ignoreHref: true
  })
  const signoff = `This is just a preview. [Click here](${url}) for the full article. [Please support local journalism!](https://madison.com/members/join/) Madison.com is $1 for the first 6 months.`;

  return text
    .split(/\r?\n/)
    .filter((_, index, ary) => ary.slice(0, index+1).filter(line => line.match(/^\s*$/)).length < 5) // count up blank lines, limit to 5 paragraphs
    .map((line) => `> ${line}`) // add quote for reddit, including on empty lines
    .filter((line) => !line.match(/^-+$/)) // eliminate long dashed line at the bottom, probably not necessary if limiting
    .join("\n")
    + `\n\n` + signoff;
}

async function MadisonDotComBot(): Promise<void> {

  let bigpromise = new Promise<void>((resolve) => { resolve() });

  const db = await DatabaseAccess.get();

  await r.getSubreddit("madisonwi").search({ query: 'site:"madison.com"', sort: 'new' }).then((submissions) => {
    const sortedSubmissions = submissions.sort((lhs, rhs) => {
      // newest first
      return rhs.created - lhs.created;
    }).filter((submission) => {
      // no more than 2 days old
      return submission.created > moment().subtract(2, "days").unix();
    });

    // print all submissions
    submissions.forEach((submission: Snoowrap.Submission, index: number) => {
      const showExcluded = false;
      if (showExcluded || sortedSubmissions.indexOf(submission) != -1) {
        console.log(index, submission.id, new Date(submission.created * 1000), submission.title);
      }
    });

    for (const submission of sortedSubmissions) {
      bigpromise = bigpromise.then(() => {
        return db.hasSeenSubmission(submission)

      }).then(async (seen: boolean) => {
        const fetched = await (submission.fetch() as Promise<Omit<Snoowrap.Submission, "then">>);
        const hasCommented = (undefined != fetched.comments.find((comment) => {
          return comment.author.name == process.env.username;
        }));

        if (hasCommented) {
          console.log(`Already commented on ${submission.id}. Skipping.`);
          if (!dryRun) {
            return;
          }
        }
        
        if (seen) {
          console.log(`Already marked ${submission.id} as read. Skipping.`);
          if (!dryRun) {
            return;
          }
        }

        console.log("Fetching summary for", `https://reddit.com/${submission.id}`, new Date(submission.created * 1000), "\n", submission.url);

        const content = await prepareArticle(submission.url);
        console.log(content);

        if (!dryRun) {
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          await submission.reply(content).then(() => {});

          await db.markSeenSubmission(submission);
          console.log(`Submitted ${submission.id} to reddit and marked as seen.`);
        }
      });
    }
  });

  return bigpromise;
}

MadisonDotComBot().then(() => {
  console.log("fin!");
});
