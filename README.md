# madisondotcombot (madison.com bot)

[madison.com](madison.com) is a local news organization in Madison, WI. Their articles often get linked on [r/madisonwi](reddit.com/r/madisonwi).

They have an aggressive, non-porous paywall. Since redditors who are referred in cannot read articles, and do not plan on becoming subscribers, this leads to frustration and madison.com links even being considered by some to be spam.

This bot monitors r/madisonwi for new submissions linking to madison.com, fetches the article content, and posts it to reddit in plain text. The hope is not to take money away from madison.com, but to improve discussion of their content and hopefully encourage redditors to subscribe.

Articles are copied under fair use for non-commercial and non-profit news reporting, educational, and commentary purposes.

## installation (systemd timer)

```
$ cat ~/.config/systemd/user/madisondotcombot.timer 
[Unit]
Description=run madisondotcombot

[Timer]
AccuracySec=2min
OnActiveSec=5sec
OnCalendar=*:0/10
Unit=madisondotcombot.service

[Install]
WantedBy=default.target

$ cat ~/.config/systemd/user/madisondotcombot.service 
[Unit]
Description=run madisondotcombot

[Service]
Type=oneshot
WorkingDirectory = $HOME/dev/madisondotcombot
ExecStart=node ./dist/index.js
```

## docker

```
$ npm run docker-build
$ npm run docker-exec
```
