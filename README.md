Local deploy
functions start
functions deploy surfHelper --trigger-http
functions surfHelper reset

Deploy to prod

gcloud beta functions deploy surfHelper --stage-bucket surfhelper --trigger-http