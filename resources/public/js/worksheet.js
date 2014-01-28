/*
 * This file is part of gorilla-repl. Copyright (C) 2014, Jony Hudson.
 *
 * gorilla-repl is licenced to you under the MIT licence. See the file LICENCE.txt for full details.
 */

// ** The worksheet wrapper **

// The main view model is wrapped in a wrapper. It exists mainly for historical reasons. It handles the UI elements that
// aren't really part of the worksheet (menu, status etc).

var worksheetWrapper = function (worksheet) {
    var self = {};

    self.worksheet = ko.observable(worksheet);

    self.fileDialogShown = ko.observable(false);

    return self;
};


// ** The worksheet **

// this viewmodel represents the worksheet document itself. Code to manage the "cursor" that is, the highlight on the
// active segment, and the position of the editor cursors, is in the worksheet, as it needs to know about the
// relationship between the segments.
var worksheet = function () {
    var self = {};

    // the content of the worksheet is a list of segments.
    self.segments = ko.observableArray();

    // serialises the worksheet for saving. The result is valid clojure code, marked up with some magic comments.
    self.toClojure = function () {
        return ";; gorilla-repl.fileformat = 1\n\n" +
            self.segments().map(function (s) {
                return s.toClojure()
            }).join('\n');
    };

    // ** Segment management **

    self.segmentIndexForID = function (id) {
        // so, this is not perhaps the most efficient way you could think of doing this, but for reasonable conditions
        // it will be fine.
        for (var i = 0; i < self.segments().length; i++) {
            if (self.segments()[i].id == id) return i;
        }
        // this had better never happen!
        return -1;
    };

    self.getSegmentForID = function (id) {
        var index = self.segmentIndexForID(id);
        if (index >= 0) return self.segments()[index];
        else return null;
    };

    self.activeSegmentIndex = null;

    self.getActiveSegment = function () {
        if (self.activeSegmentIndex != null) return self.segments()[self.activeSegmentIndex];
        else return null;
    };

    self.activateSegment = function (index, fromTop) {
        self.segments()[index].activate(fromTop);
        self.activeSegmentIndex = index;
    };

    self.deactivateSegment = function (index) {
        self.segments()[index].deactivate();
        self.activeSegmentIndex = null;
    };

    self.deleteSegment = function (index) {
        self.segments.splice(index, 1);
        // after deletion, should activate segment before, unless it was the first segment, or there are no segments
        // remaining.
        if (self.segments().length == 0) return;
        if (index == 0) self.activateSegment(0, true);
        else self.activateSegment(index - 1, false);
    };

    // ** Event handlers **

    // * Activation cursor / focus handling *

    // activation/deactivation and focusing of segments.
    eventBus.on("worksheet:leaveForward", function () {
        var leavingIndex = self.activeSegmentIndex;
        // can't leave the bottom segment forwards
        if (leavingIndex == self.segments().length - 1) return;
        self.deactivateSegment(leavingIndex);
        self.activateSegment(leavingIndex + 1, true);
    });

    eventBus.on("worksheet:leaveBack", function () {
        var leavingIndex = self.activeSegmentIndex;
        // can't leave the top segment upwards
        if (leavingIndex == 0) return;
        self.deactivateSegment(leavingIndex);
        self.activateSegment(leavingIndex - 1, false);
    });

    eventBus.on("worksheet:delete", function () {
        // if there's only one segment, don't delete it
        if (self.segments().length == 1) return;
        var deleteIndex = self.activeSegmentIndex;
        self.deleteSegment(deleteIndex);
    });

    eventBus.on("worksheet:newBelow", function () {
        // do nothing if no segment is active
        if (self.activeSegmentIndex == null) return;
        var seg = codeSegment("");
        var currentIndex = self.activeSegmentIndex;
        self.deactivateSegment(currentIndex);
        self.segments.splice(currentIndex + 1, 0, seg);
        self.activateSegment(currentIndex + 1);
    });

    // the event for this action contains the segment id
    eventBus.on("worksheet:segment-clicked", function (e, d) {
        if (self.activeSegmentIndex != null) self.deactivateSegment(self.activeSegmentIndex);
        var focusIndex = self.segmentIndexForID(d.id);
        self.activateSegment(focusIndex, true);
    });

    // * Changing segment types *

    // a helper function that changes the type of the active segment
    var changeActiveSegmentType = function (newType, newSegmentConstructor) {
        var index = self.activeSegmentIndex;
        if (index == null) return;
        var seg = self.segments()[index];
        // if the segment is already a free segment, do nothing.
        if (seg.type == newType) return;

        var contents = seg.getContents();
        var newSeg = newSegmentConstructor(contents);
        self.segments.splice(index, 1, newSeg);
        self.activateSegment(index, true);
    };

    eventBus.on("worksheet:changeToFree", function () {
        changeActiveSegmentType("free", freeSegment);
    });

    eventBus.on("worksheet:changeToCode", function () {
        changeActiveSegmentType("code", codeSegment);
    });

    // * Evaluation *

    // The evaluation command will fire this event. The worksheet will then send a message to the evaluator
    // to do the evaluation itself.
    eventBus.on("worksheet:evaluate", function () {
        // check that a segment is active
        var seg = self.getActiveSegment();
        if (seg == null) return;

        if (seg.type == "code") {
            // if this is a code segment, then evaluate the contents
            var code = seg.getContents();
            // clear the output
            seg.clearOutput();
            seg.runningIndicator(true);

            eventBus.trigger("evaluator:evaluate", {code: code, segmentID: seg.id});
        }

        // if this isn't the last segment, move to the next
        if (self.activeSegmentIndex != self.segments().length - 1) eventBus.trigger("command:worksheet:leaveForward");
        // if it is the last, create a new one at the end
        else eventBus.trigger("worksheet:newBelow")
    });

    // messages from the evaluator

    eventBus.on("evaluator:value-response", function (e, d) {
        var segID = d.segmentID;
        var seg = self.getSegmentForID(segID);
        seg.output(d.value);
    });

    eventBus.on("evaluator:console-response", function (e, d) {
        var segID = d.segmentID;
        var seg = self.getSegmentForID(segID);
        var oldText = seg.consoleText();
        // note that no escaping is done to console strings - you could cause havoc by returning inappropriate HTML
        // if you were so minded.
        seg.consoleText(oldText + d.out);
    });

    eventBus.on("evaluator:done-response", function (e, d) {
        var segID = d.segmentID;
        var seg = self.getSegmentForID(segID);
        seg.runningIndicator(false);
    });

    eventBus.on("evaluator:error-response output:output-error", function (e, d) {
        var segID = d.segmentID;
        var seg = self.getSegmentForID(segID);
        seg.errorText(d.error);
    });

    return self;
};