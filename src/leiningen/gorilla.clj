;;;; This file is part of gorilla-repl. Copyright (C) 2014, Jony Hudson.
;;;;
;;;; gorilla-repl is licenced to you under the MIT licence. See the file LICENCE.txt for full details.

;;; Packages gorilla as a leiningen plugin.

(ns leiningen.gorilla
  (:require [gorilla-repl.core :as g]
            [leiningen.core.eval :as l]))

;; This is the leiningen task. It needs no arguments, and can run outside a project (assuming you've got the plugin
;; installed globally). You can pass the arguments:
;; - :worksheet path/to/worksheet  --  loads the indicated worksheet in a new gorilla instance
(defn ^:no-project-needed gorilla
  [project & opts]
  (let [opts-map (apply hash-map opts)]
    (when-let [w (get opts-map ":worksheet")] ())
    (l/eval-in-project
      project
      `(g/run-gorilla-server))))

