/**
*
* DISTRACTION BANDIT VERSION!!!!
*
* jspsych-multi-choice-circle
* adapted from Josh de Leeuw, RBE 03/16
*
* display a set of objects, with or without a target, equidistant from fixation
* subject responds to whether or not the target is present
*
* based on code written for psychtoolbox by Ben Motz
*
* requires Snap.svg library (snapsvg.io)
*
* documentation: docs.jspsych.org
*
**/

jsPsych.plugins['multi-choice-circle'] = (function() {

  var plugin = {};

  var cumulativeRewards 
  cumulativeRewards = (typeof cumulativeRewards === 'undefined') ? 0 : cumulativeRewards;

  var cumulativeTrials
  cumulativeTrials = (typeof cumulativeTrials === 'undefined') ? 0 : cumulativeTrials;

  jsPsych.pluginAPI.registerPreload('jspsych-multi-choice-circle', 'fixation_image', 'image');
  jsPsych.pluginAPI.registerPreload('jspsych-multi-choice-instructions', 'all_stimuli_for_preload', 'image');

  plugin.trial = function(display_element, trial) {

    // stimulus information
    trial.s_location = (typeof trial.s_location === 'undefined') ? "/static/images" : trial.s_location;
    trial.s_type = (typeof trial.s_type === 'undefined') ? ".png" : trial.s_type;
    //trial.instruct_contrast = (typeof trial.instruct_contrast === 'undefined') ? 55 : trial.instruct_contrast;
    trial.target_size = (typeof trial.target_size === 'undefined') ? [100, 150] : trial.target_size;
    trial.fixation_size = trial.fixation_size || [16, 16];
    trial.circle_diameter = trial.circle_diameter || 350;
    trial.set_size = (typeof trial.set_size === 'undefined') ? trial.stimuli.length : trial.set_size;

    // reward schedule
    //trial.reward_seed = (typeof trial.reward_seed === 'undefined') ? 0 : trial.reward_seed;
    //trial.reward_std = trial.reward_std;
    //trial.p_reward_bounds = (typeof trial.p_reward_bounds === 'undefined') ? [0, 1] : trial.p_reward_bounds;

    // timing
    trial.timing_max_search = (typeof trial.timing_max_search === 'undefined') ? -1 : trial.timing_max_search;
    trial.timing_fixation = (typeof trial.timing_fixation === 'undefined') ? 200 : trial.timing_fixation;
    trial.timing_post_trial = (typeof trial.timing_post_trial === 'undefined') ? 200 : trial.timing_post_trial;
    trial.timing_feedback = (typeof trial.timing_feedback === 'undefined') ? 1000 : trial.timing_feedback;
    trial.target_offset = (typeof trial.target_offset === 'undefined') ? Math.floor(Math.random() * 360) : trial.target_offset;
    trial.extra_long_feedback = trial.extra_long_feedback || 2500;

    // mouse control parameters
    trial.mouse_err = (typeof trial.mouse_err === 'undefined') ? 15 : trial.mouse_err;
    trial.mouse_sample_rate = (typeof trial.mouse_sample_rate === 'undefined') ? 10 : trial.mouse_sample_rate; // in ms, sampling by default

    // trial behavior
    trial.leave_chosen_logical = (typeof trial.leave_chosen_logical === 'undefined') ? true : trial.leave_chosen_logical;
    if (typeof trial.choice_as_feedback_logical === 'undefined' || typeof trial.reward_image === 'undefined' || typeof trial.no_reward_image === 'undefined') {
      trial.choice_as_feedback_logical = true;
    } else { // if all three conditions hold
      trial.choice_as_feedback_logical = false;
    }

    // now finish up
    trial = jsPsych.pluginAPI.evaluateFunctionParameters(trial);
    
    var trial_complete = false;

    // deal with all the choice stimuli
    trial.stimuli_id = []; // preallocate
    for (var i = 0; i < trial.set_size; i++) {
      var imLoc = trial.s_location;
      var imStr = imLoc.concat(trial.stimuli[i]);
      imStr = imStr.concat(trial.s_type);
      trial.stimuli_id[i] = imStr;
    }

    // only keep as many stimuli as we need
    trial.stimuli = trial.stimuli.slice(0,trial.set_size);

    // now the outcome stimuli
    trial.outcome_stimuli_id = []; // preallocate
    for (var i = 0; i < trial.outcome_stimuli.length; i++) {
      var imLoc = trial.s_location;
      var imStr = imLoc.concat(trial.outcome_stimuli[i]);
      imStr = imStr.concat(trial.s_type);
      trial.outcome_stimuli_id[i] = imStr;
    }

    // screen information
    var screenw = display_element.width();
    var screenh = display_element.height();
    var centerx = screenw / 2;
    var centery = screenh / 2;

    // circle params
    var diam = trial.circle_diameter; // pixels
    var radi = diam / 2;
    var paper_size = diam + Math.max(trial.target_size[0],trial.target_size[1]);

    // stimuli width, height
    var stimw = trial.target_size[0];
    var stimh = trial.target_size[1];
    var hstimh = stimh / 2;
    var hstimw = stimw / 2;

    // fixation location
    var fix_loc = [Math.floor(paper_size / 2), Math.floor(paper_size / 2)];

    // possible stimulus locations on the circle
    var display_locs = [];
    var possible_display_locs = trial.set_size+1; // allow for a distractor location
    var target_offset = trial.target_offset;
    for (var i = 0; i < possible_display_locs; i++) {
      display_locs.push([
        Math.floor(paper_size / 2 + (cosd(target_offset + (i * (360 / possible_display_locs))) * radi) - hstimw),
        Math.floor(paper_size / 2 - (sind(target_offset + (i * (360 / possible_display_locs))) * radi) - hstimh)
      ]);
    }

    // get target to draw on
    display_element.append($('<svg id="jspsych-multi-choice-circle-svg" width=' + paper_size + ' height=' + paper_size + '></svg>'));
    var paper = Snap('#jspsych-multi-choice-circle-svg');
    // var paper = Snap('#jspsych-multi-choice-circle-svg');

    // ! --- START PROGRESS BAR BLOCK ---- !
    //                                                    DO NOT FORGET TO EDIT THE CSS FILE!!!!!!
    //
    // CSS goes here:
    //
    // #jspsych-multi-choice-circle-progress-svg {
    //     display: block;
    //     margin-left: auto;
    //     margin-right: auto;
    // }
    //
    //
    var nTrials = 300; //CAUTION!!! I'm hardcoded!
    var progress_line_offset = 80;
    var progress_half_width = paper_size/3;
    var progress_height = 28+progress_line_offset; // add to bottom for instructions
    var instruction_size = "16px";

    display_element.append($('<svg id="jspsych-multi-choice-circle-progress-svg" width=' + paper_size + ' height=' + progress_height + '></svg>'));
    var progress = Snap('#jspsych-multi-choice-circle-progress-svg');

    var progress_center = [paper_size / 2, (progress_height / 2)+progress_line_offset];

    var running_feedback = progress.rect(progress_center[0]-progress_half_width, progress_line_offset, progress_half_width*2, progress_height-progress_line_offset-5).attr({
      fill: 'white', stroke: '#415EBD', strokeWidth: 5})
    var running_feedback = progress.rect(progress_center[0]-progress_half_width, progress_line_offset, progress_half_width*2*(cumulativeTrials/nTrials), progress_height-progress_line_offset-5).attr({
      fill: '#415EBD', stroke: '#415EBD', strokeWidth: 5})
    var running_feedback = progress.text(progress_center[0],progress_line_offset+16,'progress').attr({
      fontSize: instruction_size, width: 100, textAnchor: 'middle', fill: '#cccccc'})
    // ! --- END PROGRESS BAR BLOCK ---- !

    // offset for where the paper is on the page
    var svgs = document.getElementsByTagName("svg"); // now from paper to the left and top
    var offsetLeft = svgs[0].getBoundingClientRect().left;
    var offsetTop = svgs[0].getBoundingClientRect().top;

    // some globals:
    var mousePos = [0,0];
    var mouseTime = 0;
    var not_fixated = true;
    var not_chosen = true;
    var info = {}; // make a container to gather our timestamps and such
    info.array_on_t = Math.sqrt(-1); // initialize to NaN
    info.mousePos = [];

    // now run everything  
    show_fixation();

    function show_fixation() {
      // show fixation
      var fixation = paper.image(trial.fixation_image, fix_loc[0] - trial.fixation_size[0] / 2, fix_loc[1] - trial.fixation_size[1] / 2, trial.fixation_size[0], trial.fixation_size[1]);

      // trying for mouse handling

      // look for a mouse click on fixation:
      display_element.mousedown(getMouseFixation)
      function getMouseFixation(event) {
        var x = 0;
        var y = 0;
        if (!event) var event = window.event;
        if (event.pageX || event.pageY)   {
          x = event.pageX - offsetLeft;
          y = event.pageY - offsetTop;
        }
        else if (event.clientX || event.clientY)  {
          x = event.clientX + document.body.scrollLeft
            + document.documentElement.scrollLeft;
          y = event.clientY + document.body.scrollTop
            + document.documentElement.scrollTop;
        }
        mousePos = [x,y,(getTime() - info.array_on_t), event.type]; // keep the x,y position, timestamp, and down/move

        var fu = Math.sqrt(Math.pow(mousePos[0] - fix_loc[0],2) + Math.pow(mousePos[1] - fix_loc[1],2));
        if (fu < trial.mouse_err && not_fixated) {
          // wait for the timer:
          setTimeout(function() {
            info.array_on_t = getTime(); // save the time we put up the array
            display_element.mousemove(getMouseFixation); // switch over to mouse movement control
            show_search_array(); // and put up the array
          }, trial.timing_fixation);
          not_fixated = false;
        }
        
      }

    }

    function show_search_array() {

      var search_array_images = [];

      for (var i = 0; i < display_locs.length; i++) {

        var which_image = trial.stimuli_id[i];
        var img = paper.image(which_image, display_locs[i][0], display_locs[i][1], trial.target_size[0], trial.target_size[1]);
        search_array_images.push(img);

      }

      var trial_over = false;
      var oldMouse = [0,0,0];

      function mouse_listener() {
        if (!trial_over) {
          // check to see if we have a new mouse position, if so, push
          if (mousePos != oldMouse) {
            info.mousePos.push(mousePos); // if so, push/save the samples we get
            oldMouse = mousePos;
            // now see if the new sample has reached one of our targets
            for (var i = 0; i < possible_display_locs; i++) {
              fu = Math.sqrt(Math.pow(((mousePos[0]) - (display_locs[i][0]+hstimw)),2) + Math.pow(((mousePos[1]) - (display_locs[i][1]+hstimh)),2));
              if (fu < (hstimh+hstimw)/1.75) {
                // stop checking
                info.choice = i;
                info.choice_t = getTime();
                info.mousePos.push(mousePos); // one last mouse save
                clearInterval(checkMouse);
                // get info about the choice and put that here
                after_response(info);
              }
            }
          }
        } else {
          clearInterval(checkMouse);
        }
      }
      checkMouse = setInterval(mouse_listener,trial.mouse_sample_rate);
      // $(document).mousemove(mouse_listener)

      var after_response = function(info) {

        trial_over = true;

        info.correct = 1;
        info.rt = info.choice_t - info.array_on_t;

        // get probability of reward of this chosen target
        info.p_reward = trial.reward_seed[info.choice];

        // now roll the dice!
        info.reward = Math.random() < info.p_reward;

        // now update the subjects' display
        paper.clear(); // clear the drawing
        if (trial.leave_chosen_logical) { // put our chosen target back up, if requested
          if (info.reward) {
            var which_image = trial.outcome_stimuli_id[1];
          } else {
            var which_image = trial.outcome_stimuli_id[0];
          }
          var img = paper.image(which_image, display_locs[info.choice][0], display_locs[info.choice][1], trial.target_size[0], trial.target_size[1]);
        }

        display_element.off('mousemove'); // unbind listener from mouse
        do_local_feedback(info); // now tell the Ss how they did

        // go through 2 layers of feedback
        setTimeout(function() {
          do_global_feedback();
          setTimeout(function() {
          clear_display();
          end_trial(info, trial);
          }, trial.timing_feedback);
        }, trial.timing_feedback);

      }

      function do_local_feedback(info) {
        //choose what feedback image & text to present
        if (info.reward) {
          var feedback_image = trial.reward_image;
          var feedback_str = '+1';
          var feedback_color = "#0CA101";
          cumulativeRewards += 1;
        } else {
          var feedback_image = trial.no_reward_image;
          var feedback_str = '0';
          var feedback_color = "#C10101";
        }
        // replace the feedback image with the choice, if that's selected
        if (trial.choice_as_feedback_logical) {
          var feedback_image = trial.stimuli_id[info.choice];
        }
        if (!trial.leave_chosen_logical) {
          var feedback = paper.image(feedback_image, fix_loc[0]-(trial.target_size[0]/2), fix_loc[1]-(trial.target_size[1]/2)-40, trial.target_size[0], trial.target_size[1]);
        }
        var text_feedback = paper.text(fix_loc[0]-1,fix_loc[1]+(trial.target_size[1]/2)-50,feedback_str).attr({
          fontSize: "50px", width: 100, textAnchor: 'middle', fill: feedback_color, fontWeight: 'bold'})
      }

      function do_global_feedback() {
        // give them the running total now
        paper.clear(); // clean slate
        var feedback_str = JSON.stringify(cumulativeRewards);
        var text_feedback = paper.text(fix_loc[0]-1,fix_loc[1]-30,'total points:').attr({
          fontSize: "30px", width: 100, textAnchor: 'middle', fontStyle: 'oblique', fill: '#415EBD'})
        var text_feedback = paper.text(fix_loc[0]-1,fix_loc[1]+30,feedback_str).attr({
          fontSize: "50px", width: 100, textAnchor: 'middle', fontWeight: 'bold', fill: '#415EBD'})

      }

      if (trial.timing_max_search > -1) {

        if (trial.timing_max_search == 0) {
          if (!trial_over) {

            // jsPsych.pluginAPI.cancelKeyboardResponse(key_listener);

            trial_over = true;

            var rt = -1;
            var correct = 0;
            var choice = -1;

            clear_display();

            end_trial(info, trial);
          }
        } else {

          setTimeout(function() {

            if (!trial_over) {

              // jsPsych.pluginAPI.cancelKeyboardResponse(key_listener);

              trial_over = true;

              var rt = -1;
              var correct = 0;
              var choice = -1;

              clear_display();

              end_trial(info, trial);
            }
          }, trial.timing_max_search);
        }
      }

      function clear_display() {
        display_element.html('');
      }
    }


    function end_trial(info, trial) {

      cumulativeTrials += 1; // advance trial counter

      // data saving
      var trial_data = {
        "trial_type": "multi-choice-circle",
        "trial_index": jsPsych.currentTimelineNodeID(),
        "correct": info.correct,
        "rt": info.rt,
        "choice": info.choice,
        "reward_seed": trial.reward_seed,
        "p_reward": info.p_reward,
        "reward": info.reward,
        "choice_t": info.choice_t,
        "array_on_t": info.array_on_t,
        "timing_fixation": trial.timing_fixation,
        "locations": JSON.stringify(display_locs),
        "stimulus_orientations": trial.stimuli,
        "stimulus_contrasts": trial.contrasts,
        "set_size": trial.set_size,
        "mouse_position": info.mousePos, // x,y,time from array onset
        "cumulative_rewards": cumulativeRewards,
      };

      if (trial.timing_post_trial > 0) {
          setTimeout(function() {
              jsPsych.finishTrial(trial_data);
          }, trial.timing_post_trial);
      }
      else {
          jsPsych.finishTrial(trial_data);
      } // call block.next() to advance the experiment after a delay.
    }
  };

  // helper function for determining stimulus locations

  function cosd(num) {
    return Math.cos(num / 180 * Math.PI);
  }

  function sind(num) {
    return Math.sin(num / 180 * Math.PI);
  }

  function getTime() {
    return (new Date()).getTime();
  }
 
  return plugin;
})();
