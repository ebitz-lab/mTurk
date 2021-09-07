# this file imports custom routes into the experiment server

from flask import Blueprint, render_template, request, jsonify, Response, abort, current_app
from jinja2 import TemplateNotFound
from functools import wraps
from sqlalchemy import or_

from psiturk.psiturk_config import PsiturkConfig
from psiturk.experiment_errors import ExperimentError, InvalidUsage
from psiturk.user_utils import PsiTurkAuthorization, nocache

# # Database setup
from psiturk.db import db_session, init_db
from psiturk.models import Participant
from json import dumps, loads

# # walk generation
# from numpy import random, average
import random
import math

# load the configuration options
config = PsiturkConfig()
config.load_config()
# if you want to add a password protect route use this
myauth = PsiTurkAuthorization(config)

# explore the Blueprint
custom_code = Blueprint('custom_code', __name__,
                        template_folder='templates', static_folder='static')


###########################################################
#  serving warm, fresh, & sweet custom, user-provided routes
#  add them here
###########################################################

# ----------------------------------------------
# example custom route
# ----------------------------------------------
@custom_code.route('/my_custom_view')
def my_custom_view():
    # Print message to server.log for debugging
    current_app.logger.info("Reached /my_custom_view")
    try:
        return render_template('custom.html')
    except TemplateNotFound:
        abort(404)

# ----------------------------------------------
# example using HTTP authentication
# ----------------------------------------------
@custom_code.route('/my_password_protected_route')
@myauth.requires_auth
def my_password_protected_route():
    try:
        return render_template('custom.html')
    except TemplateNotFound:
        abort(404)

# ----------------------------------------------
# example accessing data
# ----------------------------------------------
@custom_code.route('/view_data')
@myauth.requires_auth
def list_my_data():
    users = Participant.query.all()
    try:
        return render_template('list.html', participants=users)
    except TemplateNotFound:
        abort(404)

# ----------------------------------------------
# example computing bonus
# ----------------------------------------------
@custom_code.route('/compute_bonus', methods=['GET'])
def compute_bonus():
    # check that user provided the correct keys
    # errors will not be that gracefull here if being
    # accessed by the Javascrip client
    if not 'uniqueId' in request.args:
        # i don't like returning HTML to JSON requests...  maybe should change this
        raise ExperimentError('improper_inputs')
    uniqueId = request.args['uniqueId']

    try:
        # lookup user in database
        user = Participant.query.\
            filter(Participant.uniqueid == uniqueId).\
            one()
        user_data = loads(user.datastring)  # load datastring from JSON
        bonus = 0

        for record in user_data['data']:  # for line in data file
            trial = record['trialdata']
            if trial['trial_type']=='multi-choice-circle':
                if trial['reward']==True:
                    bonus += 0.02
            elif trial['trial_type']=='survey-text':
                if '55414UMN' in trial['passcode']:
                    bonus += 0.50
        user.bonus = bonus
        db_session.add(user)
        db_session.commit()
        resp = {"bonusComputed": "success"}
        return jsonify(**resp)
    except:
        abort(404)  # again, bad to display HTML, but...

# ----------------------------------------------
# generate reward structure for the task
# ----------------------------------------------
@custom_code.route('/gen_walk', methods=['GET'])
def gen_walk():

    # parse the input
    if not 'min' in request.args:
        minV = 0.1
    else:
        minV = float(request.args['min'])

    if not 'max' in request.args:
        maxV = 0.9
    else:
        maxV = float(request.args['max'])

    if not 'hazard' in request.args:
        hazard = 0.2
    else:
        hazard = float(request.args['hazard'])

    if not 'nTrials' in request.args:
        nTrials = 300
    else:
        nTrials = int(request.args['nTrials'])

    if not 'nPractice' in request.args:
        nPractice = 20
    else:
        nPractice = int(request.args['nPractice'])

    if not 'nArms' in request.args:
        nArms = 3
    else:
        nArms = int(request.args['nArms'])

    if not 'stepSize' in request.args:
        stepSize = 0.1
    else:
        stepSize = float(request.args['stepSize'])

    # for the practice portion, we want to ensure success + switches
    practice_opts = [0.2, 0.3, 0.7] # see practiceThresholds.m for rationale

    # # now generate the walk from this input
    walkList = [] # container

    for arm in range(0,nArms):
        armList = [] # container

        # for the practice portion, we want to ensure success, so arms
        prob = practice_opts.pop(random.randint(1,len(practice_opts))-1)

        for trial in range(0,nPractice+1):
            armList.append(prob) # append to the list

        # now for the trials portion
        # reseed the starting values
        prob = round((random.uniform(0, 1) * (1/stepSize))) / (1/stepSize) + minV
        prob = min(prob,maxV) # account for upper bound
        prob = max(prob,minV) # and the lower bound

        # now iterate through trials
        for trial in range(nPractice+1,nTrials+1):
            # check to see if we need to update the value
            if random.uniform(0, 1) < hazard:
                prob = prob + ((math.floor(random.uniform(0, 2))*2)-1) * stepSize
                prob = round(prob * (1/stepSize)) / (1/stepSize) # deal with rounding issues
                prob = min(prob,maxV) # account for upper bound
                prob = max(prob,minV) # and the lower bound

            armList.append(prob) # append to the list

        walkList.append(armList)

    # declare the output from the function
    return jsonify(walkList)