''' a data dump job to encode each person as a data file in JSON '''
import subprocess
import json
import re
import base64
import urllib
from urllib import HTTPError
import time
import datetime
import os
import sys

# save to relative path using alias
imgStore = "web/images/{0}.jpg"

'''
Employee Definition
(Name: Key)
{
    DN: dn
    Name: displayName
    Alias: uid
    Id: uidNumber | employeeNumber
    Phone: mobile
    Country: c
    Location: l
    State: st
    Zipcode: postalCode
    Manager: manager
    IsManager: pinManager
    Title: title
    Type: employeeType
    Status: organizationalStatus
}
'''
mapping = {
    'displayname': 'Name',
    'uid': 'Alias',
    'uidnumber': 'Id',
    'employeenumber': 'Id',
    'mobile': 'Phone',
    'c': 'Country',
    'l': 'Location',
    'st': 'State',
    'postalcode': 'Zip',
    'manager': 'Boss',
    'pinmanager': 'IsManager',
    'title': 'Title',
    'description': 'Title',
    'employeetype': 'Type',
    'organizationalstatus': 'Status',
    'departmentnumber': 'Department',
}


def pipeio(command):
    p = subprocess.Popen(command, stdout=subprocess.PIPE, shell=True)
    return p.communicate()[0]


def is302(url):
    try:
        return urllib.urlopen(url).geturl() is not url
    except HTTPError as e:
        print('Http Error on {0}: code={1}'.format(url, e.code))
        return True


# use slack HTTP API to fetch user info
profile_api = 'https://slack.com/api/users.profile.get?token={0}&user={1}&pretty=1'
members_api = 'https://slack.com/api/users.list?token={0}&pretty=1'

# TODO: fill slack API token if you use slack to fetch user data
# fill the token to be able to fetch data from slack
slack_token = ''
slacks = {}


def download_user(user):
    # read members
    if 'profile' not in user:
        print('no profile for user: {0}'.format(q))
        return

    # profile of this user
    p = user['profile']

    # download the image_72 and
    name = p['display_name']
    image = p['image_192']

    # just set slacks for now with these properties
    l = image.find('&d=https')
    if l is -1:
        l = len(image)
    elif is302(image):
        l = -1

    if l > 0:
        slacks[name] = {'id': user['id'],
                        'image': image[0:l], 'status': p['status_text']}


# fetch all members of current team
q = urllib.Request(members_api.format(slack_token))
r = json.loads(urllib.urlopen(q).read())
c = 0
if r['ok']:
    users = r['members']
    for user in users:
        download_user(user)
        c += 1
        if c % 100 is 0:
            print('slack users progress: {0}%'.format(c*100.0/len(users)))

print('processed {0} users.'.format(c))


def dispatch(person, key, value):
    if key in mapping:
        person[mapping[key]] = value
        # get manager alias for linking purpose
        if key == 'manager':
            for part in value.split(','):
                uid = part.split('=')
                if len(uid) == 2 and uid[0] == 'uid':
                    person['Boss'] = uid[1]


# TODO: missing user->start_day mapping
# Need a method to fill user to start date mapping
# user -> start date mapping
# shawn: {hire_date: '2000-08-01', org_name: 'ceo'}
userStartDates = {}

# alias of given people, return directs
# command template with user ID passed in
# LDAP link like ldaps://<server> -b ou=people,dc=<company>,dc=com manager=uid={0},ou=people,dc=<company>,dc=com
cmd = 'ldapsearch -xLLL -H {0}'


def fetch(uid):
    result = pipeio(cmd.format(uid))
    directs = []
    person = {}
    for item in result.splitlines():
        # new line indicating a new person is formed
        if len(item) is 0:
            # fetch image from a valid object
            if 'Alias' in person:
                alias = person['Alias']

            # person['IsWAU'] = ldap_to_wau.get(alias, False)
            if alias in slacks:
                s = slacks[alias]
                person['S'] = s['id']
                person['P'] = s['image']
                person['Z'] = s['status']
            else:
                person['P'] = '0'

            # tenure = age(alias)
            # if tenure > 0:
            #    person['T'] = tenure
            if alias in userStartDates and userStartDates.get(alias):
                # changes to add Org_name to employee details - BPP-1438
                person['Since'] = userStartDates[alias].get('hire_date')
                person['Organization'] = userStartDates[alias].get('org_name')

            directs.append(person)
            person = {}
            continue

        # parse lines for current person object
        kv = item.split(':')
        # only process valid items
        if len(kv) == 2:
            key = kv[0].strip().lower()
            dispatch(person, key, kv[1].strip())

    # the person object
    return directs


# to build all data, let us emulate all numbers from 10000 and stop at 20000
# storage data structure - everything in memory and dump to single file
storage = {
    'size': 0,
    # basically alias->index, use index to fetch object
    'index': {},
    'directs': {},
    # total employees in reporting tree - only for managers
    'rollups': {},
    # basiclaly list of person
    'people': []
}

count = 0
people = storage['people']
idx = storage['index']

# TODO: fill the user name of the company head (CEO)
queue = ['ceo']

# some tag

fIsManager = 'IsManager'
fAlias = 'Alias'
hundreds = 0
while len(queue) > 0:
    if count / 100 > hundreds:
        hundreds = count/100
        print('processed {0} employees, queue size={1}'.format(
            count, len(queue)))

    current = queue.pop(0)
    directs = fetch(current)

    # some people title is manager but not real manager
    if len(directs) is 0:
        people[idx[current]][fIsManager] = False

    for obj in directs:
        if fAlias in obj:
            # put it in people list
            alias = obj[fAlias]
            people.append(obj)

            # update index
            idx[alias] = count

            # move to next
            count += 1

            # enqueue this person if it's manager
            # print(json.dumps(obj, default=lambda o: o.__dict__))
            if fIsManager in obj and obj[fIsManager] == 'TRUE' and alias != current:
                # print('enqueue {0}'.format(alias))
                queue.append(alias)

# update count in the object
storage['size'] = count

# Now assume we got every one in the storage, update each person's manager
print('Found people count: {0}'.format(len(people)))

# build directs alias in index
directs = storage['directs']
for p in people:
    alias = p['Alias']
    if 'Boss' in p:
        boss = p['Boss']
        if boss == alias:
            print('{0} report to self.'.format(alias))
            continue

        if boss in directs:
            directs[boss].append(alias)
        else:
            directs[boss] = [alias]
    else:
        print('{0} has no boss.'.format(alias))

# build rollup numbers for each manager
rollups = storage['rollups']


def rollup(uid):
    if uid in rollups:
        return rollups[uid]

    count = 0
    # has directs
    if uid in directs:
        d = directs[uid]
        count = len(d)
        for x in d:
            count += rollup(x)

    # set and value and return
    rollups[uid] = count
    return count


for m in directs:
    if m not in rollups:
        rollups[m] = rollup(m)

# dump the whole object into a file
with open('data.json', mode='w') as f:
    json.dump(storage, f, default=lambda o: o.__dict__)
