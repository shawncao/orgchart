// global data in current site
var orgchart = {};
var data = {};
const anniversaries = [];
const tenures = [];
const chain = [];
// TODO: fill the company head (ceo) alias here
const splash = "ceo";
const separator = ',';
const maxline = 20;
const txt = "click card status bar to select the person...";
const charts = {
    '@loc': p => p.Location,
    '@role': p => p.IsManager == 'TRUE' ? 'Manager' : 'IC',
    '@title': p => p.Title,
    '@status': p => p.Status,
    '@type': p => p.Type,
    '@country': p => p.Country,
    '@state': p => p.State,
    '@l9': p => p.State,
};

// alias list of speical levels (high level people)
const level_1 = [];
const level_2 = [];
const level_3 = [];

// preset lists to display
const lists = {
    '$l7': {
        name: "<L1> People",
        list: level_1
    },
    '$l8': {
        name: "<L2> People",
        list: level_2
    },
    '$l9': {
        name: "<L3> People",
        list: level_3
    },
    '$yday': {
        name: "Anniversaries",
        list: anniversaries
    }
};


function cl() {
    $("#list").text(txt);
}

function sl() {
    const list = $("#list").text();
    if (list != txt) {
        hash(list);
    }
}

String.prototype.trunc = String.prototype.trunc ||
    function (n) {
        return (this.length > n) ? this.substr(0, n - 1) + '...' : this;
    };
// make a cube
function cube(node, parent, p, rl, role, noz) {
    const c_color = ['#FF4500', '#000080', '#228B22'];
    const c_bg = ['#fee', '#efe', '#eef'];
    const c_leaf = [false, false, true];
    const bg = c_bg[role];
    const leaf = rl && c_leaf[role];
    const focus = (role == 1);
    let color = c_color[role];

    var meta = 'IC';
    if (p.Alias in data.directs) {
        var drs = data.directs[p.Alias].length;
        meta = "+" + drs + " directs";
        if (p.Alias in data.rollups) {
            var count = data.rollups[p.Alias];
            if (count > 0 && count > drs) {
                meta += " +" + count + " rollups";
            }
        }
    }

    // timestamp in person
    if ('T' in p) {
        var unix = p['T']
        if (unix > 0) {
            var yrs = ((Date.now() - unix * 1000.0) / 1000 / 3600 / 24 / 365).toFixed(1);
            if (yrs > 0) {
                meta += " > " + yrs + "yrs"
            }
        }
    }

    if (p.Status && p.Status !== 'Active') {
        // grey color for terminated account
        if (p.Status === 'Terminated') {
            color = 'grey';
        }

        // always show status if it's not active
        meta += ' (' + p.Status + ')';
    }

    var name = p.Name;
    if (name) {
        name = name.trunc(maxline);
    }

    if (level_3.indexOf(p.Alias) >= 0) {
        name += ' (E3)';
    } else if (level_2.indexOf(p.Alias) >= 0) {
        name += ' (E2)';
    } else if (level_1.indexOf(p.Alias) >= 0) {
        name += ' (E1)';
    }

    var title = p.Title || "";
    if (title && !focus) {
        title = title.trunc(maxline);
    }
    title = title.padEnd(maxline, ' ');

    // has photo will be end with alias.jpg
    var photo = 'images/ph.png';
    if (!!p.P && p.P !== '0') {
        photo = p.P
    }

    // not show slack status
    // const quote = (p.Z || "slack status...").trunc(30);
    var depart = p.Department || "~free";
    if (!focus) {
        depart = depart.trunc(maxline);
    }

    const lines = [name, title, depart, p.Location];
    const since = p.Since || "unknown";
    // calcullate the rank of it
    const index = tenures.indexOf(since);
    const pct = Math.floor(index * 100 / tenures.length);
    lines.push(`[tenure > ${pct}%] ~${since}`);

    if (!noz && p.Z) {
        if (focus) {
            lines.push(`"${p.Z.trunc(maxline)}"`);
        } else {
            // show an icon saying this person has slack status 
            // https://en.wikipedia.org/wiki/Miscellaneous_Symbols
            const sun = String.fromCharCode(0x2600);
            meta = `${sun} ${meta}`;
        }
    }

    // display stars for people who has anniversary
    if (anniversaries.indexOf(p.Alias) !== -1) {
        // options:
        // 2691 flag, 2698 flower, 26AC circle, 26F3 flag in hole
        // 2605 star, 2615 coffee, 2618 leaf, 2665 heart
        const badge = String.fromCharCode(0x26F3);
        let count = new Date().getFullYear() - new Date(p.Since).getFullYear();
        if (count) {
            meta = `${new Array(count + 1).join(badge)} ${meta}`;
        }
    }

    return new Cube(node, parent, {
        n: p.Alias,
        c: color,
        b: bg,
        i: {
            src: photo,
            text: lines
        },
        m: meta,
        l: leaf
    });
}

// represent a drawing node in chart
class Node {
    constructor(person) {
        this.person = person;
        this.children = [];
        this.folk = false;
        this.pid = 0;
    }

    add(node) {
        this.children.push(node);
    }
    focus() {
        this.folk = true;
    }
}

function chainUsers(users) {
    // single person chain
    if (users.length == 1) {
        return treeChain(users[0]);
    }

    // multiple persons chain
    // map of alias to node
    var map = {};
    var root = null;
    for (var i = 0; i < users.length; ++i) {
        var alias = users[i];
        var cur = data.people[data.index[alias]];

        // already visited and placed in the map
        if (alias in map) {
            map[alias].focus();
            continue;
        }

        var node = new Node(cur);
        map[alias] = node;

        // all the way going up
        while (true) {
            if (!(cur.Boss in data.index)) {
                break;
            }

            var bid = data.index[cur.Boss];
            var m = data.people[bid];
            if (m.Alias == cur.Alias) {
                break;
            }


            // either already in map or create a new one
            if (m.Alias in map) {
                var joint = map[m.Alias];
                joint.focus();
                joint.add(node);
                break;
            }

            var mNode = new Node(m);
            map[m.Alias] = mNode;
            mNode.add(node);
            node = mNode;
            cur = m;
        }

        // any round of traverse, root will be found
        if (root === null) {
            root = node;
        }
    }

    return root;
}

function treeChain(user) {
    var idx = data.index[user];
    var me = data.people[idx];
    // push all boss
    var root = new Node(me);
    root.focus();

    // if current is a manager - push all its directs
    if (me.Alias in data.directs) {
        var drs = data.directs[me.Alias];
        for (var k = 0; k < drs.length; ++k) {
            root.add(new Node(data.people[data.index[drs[k]]]));
        }
    }

    var cur = me;
    while (true) {
        if (!(cur.Boss in data.index)) {
            break;
        }

        var bid = data.index[cur.Boss];
        var m = data.people[bid];
        if (m.Alias == cur.Alias) {
            break;
        }

        var node = new Node(m);
        node.add(root);
        root = node;
        cur = m;
    }

    return root;
}

function paint(root, rl, noz) {
    // new org chart instance before painting
    orgchart = new OrgChart('chart');

    // draw up chain
    var k = 1;
    var role = 0;
    var queue = [root];

    // when queue is still having nodes
    while (queue.length > 0) {
        // peek the last one (to be pop)
        var cur = queue[queue.length - 1];
        // cache for future reference
        chain[k] = cur.person;
        queue.pop();

        // change theme everytime folk value changed
        if (cur.folk) {
            role = 1;
        } else if (role == 1) {
            role = 2;
        }

        // push myself and set myself as parent
        orgchart.Push(cube(k, cur.pid, cur.person, rl, role, noz));

        // add all children into the same queue
        // wrap rows based on maximum items per row
        var row = 4;
        for (var i = 0; i < cur.children.length; ++i) {
            var n = cur.children[i];
            n.pid = i >= row ? (k + i - row + 1) : k;

            // enqueue
            queue.unshift(n);
        }

        // increment index
        k++;
    }

    // add my self as node
    orgchart.NodeClick = function (id) {
        hash(chain[id].Alias);
    };

    // display search area 
    orgchart.NodeSearch = function (id) {
        // add this guy to the selected list
        let alias = chain[id].Alias;
        const value = $("#list").text();
        if (value != txt) {
            alias = `${value},${alias}`;
        }
        $("#list").text(alias);
    };

    // do the paint work
    orgchart.Draw();
}

function pie(data, title) {
    orgchart = new OrgChart('chart');
    var c = orgchart.Canvas;
    var size = window.innerWidth;
    c.width = size * dpr;
    c.height = size;
    orgchart.Pie(data, true, title);
}

// paint chart
function chart(key) {
    var distr = {};
    var count = 0;
    var fetch = charts[key];
    for (var i = 0; i < data.people.length; ++i) {
        var loc = fetch(data.people[i]);
        if (!!loc && loc !== 'undefined') {
            if (loc in distr) {
                distr[loc] += 1;
            } else {
                distr[loc] = 1;
                count++;
            }
        }
    }

    // top 5
    var top = 6;
    if (count > top) {
        var sortable = [];
        for (var k in distr) {
            sortable.push([k, distr[k]]);
        }

        // sort items by value
        sortable.sort(function (a, b) {
            return b[1] - a[1];
        });
        distr = sortable.slice(0, top).reduce(function (p, c) {
            p[c[0]] = c[1];
            return p;
        }, {});
    }

    // draw locations pie with unified width and height
    pie(distr, "DISTRIBUTION BY " + key);
}

// draw a user cube
function draw(users) {
    // charts handling
    if (users.length == 1) {
        var key = users[0];
        if (key in charts) {
            return chart(key);
        }

        // preset set list conversion
        if (key in lists) {
            // the lists may have stale data who left company
            const presetList = lists[key];
            return preset(presetList.name, presetList.list.filter(e => e in data.index));
        }
    }

    // manager tree chain
    var root = chainUsers(users);

    // paint this chain
    paint(root, users.length == 1);
}

$(document).ready(function () {
    cl();
    // Hard code this UI features
    Utility.SearchUI = 'oc';
    Utility.Font = "7.7pt Sans-Serif";

    Utility.ImageDimen = {
        width: 50,
        height: 50
    };
    // load json data size, index, directs, people
    $.getJSON('scripts/data.json.gz', function (d) {
        data = d;

        // sort all tenure age
        const today = new Date();
        for (var i = 0; i < data.people.length; ++i) {
            var p = data.people[i];
            if (p.Since) {
                tenures.push(p.Since);
                const d = new Date(p.Since);
                if (d.getMonth() == today.getMonth() && d.getDate() == today.getDate()) {
                    anniversaries.push(p.Alias);
                }
            }
        }

        // convert to yyyy-mm-dd date format and get time value of it
        const since2time = (x) => new Date(x.replace(/(\d{2})\/(\d{2})\/(\d{2})/, '20$3-$1-$2')).getTime();
        // sort the array in descending order
        tenures.sort((a, b) => since2time(b) - since2time(a));

        // draw a default person
        drawUrl();
    });

    // hook up hash change event
    window.onhashchange = function () {
        drawUrl();
    };

    // check if we know current user
    $.getJSON('user', (u) => {
        if (u && u.user) {
            $("#user").text(u.user);
            if (location.hash.length == 0) {
                hash(u.user);
            }
        }
    });
});

function drawUrl() {
    // handle search term syntax
    var h = location.hash.substr(1);
    if (h.indexOf("?") === 0) {
        srch(h.substr(1));
        return;
    }

    draw(getHash());
}

function getHash() {
    if (location.hash && data.index) {
        var alias = location.hash.substr(1);
        if (alias in data.index) {
            return [alias];
        }

        // if it is an alias list
        if (alias.indexOf(separator) > -1) {
            var list = alias.trim().split(/\s*,\s*/).filter(e => (e.trim() in data.index));
            // if we have a valid list
            if (list && list.length > 0) {
                return list;
            }
        }

        // special hash tags
        if (alias in charts || alias in lists) {
            return [alias];
        }
    }

    return [splash];
}

function hash(key) {
    window.location.hash = '#' + key;
}

function clr(input) {
    input.value = '';
}

function go(ele) {
    if (event.key === 'Enter') {
        var key = ele.value;

        if (!key) {
            return;
        }

        // if alias match or contains separator
        if (key in data.index || key.indexOf(separator) > -1) {
            hash(key.replace(/\s/g, ''));
            clr(ele);
            return;
        }

        // search the key
        hash("?" + key);
        clr(ele);
    }
}

function srch(key) {
    key = decodeURI(key).trim();
    // do name match up to 40 results ignore case
    var max = 100;
    var search = {
        'Alias': '#',
        'Name': '',
        'Title': 'Search Results',
        'Phone': '',
        'Location': ''
    };

    var root = new Node(search);
    root.focus();
    var regex = key.split(' ').map(e => new RegExp(e, "i"));
    var rsize = regex.length;
    var results = 0;
    for (var i = 0; i < data.people.length; ++i) {
        var p = data.people[i];
        var res = -1;
        if (rsize === 1) {
            res = p.Alias.search(regex);
        }

        if (res === -1 && p.Name) {
            var b = true;
            for (var k = 0; k < rsize; ++k) {
                b = b && (p.Name.search(regex[k]) >= 0);
            }
            res = b ? 0 : -1;
        }

        if (res >= 0) {
            root.add(new Node(p));
            if (results++ >= max) {
                break;
            }
        }
    }

    if (results > 0) {
        var sr = 'Found People: ' + results;
        console.log(sr);
        search.Location = sr;
        paint(root, true, true);
    }
}

function preset(name, users) {
    // do name match up to 40 results ignore case
    var top = {
        'Alias': '#',
        'Name': 'public list',
        'Title': name,
        'Phone': '',
        'Location': `total ${users.length} people.`
    };

    var root = new Node(top);
    root.focus();
    users.map(e => root.add(new Node(data.people[data.index[e]])));
    paint(root, true, true);
}

function copy() {
    const canvas = orgchart.Canvas;
    if (canvas && navigator.clipboard) {
        canvas.toBlob((blob) => {
            const item = new ClipboardItem({
                "image/png": blob
            });
            navigator.clipboard.write([item]);
            alert("Copied - you can paste the image somewhere now!");
        });
    }
}