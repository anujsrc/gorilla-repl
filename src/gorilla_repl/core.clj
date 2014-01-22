;;;; This file is part of gorilla-repl. Copyright (C) 2014, Jony Hudson.
;;;;
;;;; gorilla-repl is licenced to you under the MIT licence. See the file LICENCE.txt for full details.

(ns gorilla-repl.core
  (:use compojure.core)
  (:require [compojure.handler :as handler]
            [compojure.route :as route]
            [ring.server.standalone :as server]
            [ring.middleware.keyword-params :as keyword-params]
            [ring.middleware.nested-params :as nested-params]
            [ring.middleware.params :as params]
            [ring.middleware.session :as session]
            [cemerick.drawbridge :as drawbridge])
  (:gen-class))

;; I haven't read the compojure/ring docs, so I'm not sure whether the below really makes sense. Seems to work though.

(def ^:private drawbridge
  (-> (drawbridge/ring-handler)
      (keyword-params/wrap-keyword-params)
      (nested-params/wrap-nested-params)
      (params/wrap-params)
      (session/wrap-session)))

(defroutes app-routes
           (ANY "/repl" {:as req} (drawbridge req))
           (route/resources "/"))

(defn run-gorilla-server
  []
  (println "Ctrl+C to exit.")
  (server/serve app-routes {:port          8080
                            :join?         true
                            :open-browser? true
                            :browser-uri   "worksheet.html"
                            :auto-reload?  false}))

(defn -main []
  (run-gorilla-server))
