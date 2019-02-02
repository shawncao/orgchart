/*!
 * File Created: February 2, 2012 
 * Created by Shawn Cao for rendering org chart in HTML5 Canvas
 * 
 */

/**
 * utility to help complete some basic tasks
 */
var dpr = window.devicePixelRatio || 1;
var Utility = new function () {
    //solid object
    this.IsSolid = function (obj) {
        //if it's null pointer
        if (this.IsNull(obj)) {
            return false;
        }

        //if this is a boolean object
        if (typeof obj === 'boolean') {
            return obj;
        }

        //other case, treat it as solid object
        return true;
    };

    //identify whether an object is a function or not
    this.IsFunction = function (obj) {
        return !this.IsNull(obj) && typeof obj === 'function';
    };

    //identify whether an obj is null
    this.IsNull = function (obj) {
        return obj === null || obj === undefined;
    };

    //call Func interface on each item in arr
    //Func will return a flag indicate continue the loop or not
    //if the reuslt is solid: object or true
    //we will stop the loop and return that solid object
    //else we will go through every item and reutrn null finannly
    this.Each = function (arr, Func) {
        for (var i = 0; i < arr.length; ++i) {
            var result = Func(arr[i], i);
            if (Utility.IsSolid(result)) {
                return result;
            }
        }
        return null;
    };

    //draw circle
    this.DrawCircle = function (canvas, x, y, r, fill, color) {
        //draw this cube
        canvas.fillStyle = fill;
        canvas.beginPath();
        canvas.arc(x, y, r, 0, 2 * Math.PI, false);
        canvas.strokeStyle = color;
        canvas.stroke();
    };

    this.DrawConnection = function (canvas, start, end) {
        this.DrawLine(canvas, start, end, Utility.LineWidth, Utility.LineColor);
    };

    this.DrawSeperator = function (canvas, start, end) {
        this.DrawLine(canvas, start, end, 0.5, Utility.CommandColor);
    };

    //draw line
    this.DrawLine = function (canvas, start, end, lw, color) {
        canvas.beginPath();
        canvas.lineWidth = lw;
        canvas.strokeStyle = color;
        canvas.moveTo(start.x, start.y);
        canvas.lineTo(end.x, end.y);
        canvas.stroke();
    };

    //draw rectangle
    this.DrawRect = function (canvas, position, dim, bg) {
        canvas.strokeStyle = Utility.CubeBd;
        canvas.fillStyle = bg;
        var lw = Utility.LineWidth;
        canvas.lineWidth = lw;
        canvas.fillRect(position.x + lw, position.y + lw, dim.width - 2 * lw, dim.height - 2 * lw);
        canvas.strokeRect(position.x, position.y, dim.width, dim.height);
    };

    //draw text on the screen
    this.DrawText = function (canvas, position, text, color) {
        canvas.fillStyle = color;
        canvas.fillText(text, position.x, position.y);
    };

    //search clicked node from a root node
    this.SearchClickedOne = function (node, x, y) {
        if (node.ClickMe(x, y)) return node;
        return this.Each(node.Children, function (item) {
            return Utility.SearchClickedOne(item, x, y);
        });
    };

    //properties
    this.MaxCubeWidth = 120;
    this.MinCubeWidth = 50;
    this.MinCubeHeight = 50;
    this.MaxCubeHeight = 150;
    this.LevelGap = 40;
    this.CubeGap = 10;
    this.TextMargin = 4;
    this.LineHeight = 10;

    //color themes
    this.CubeBg = "rgb(237, 247, 255)";
    this.CubeBd = "rgb(181, 217, 234)";
    this.LineColor = "rgb(51,136,221)";
    this.CommandColor = 'gray';
    this.Font = "10px Sans-Serif";
    this.SearchUI = 'search';
    this.LineWidth = 2;
    this.ImageDimen = {
        width: 70,
        height: 70
    };
};

/**
 * define cube to hold each node
 */
function Cube(id, parent, data) {
    if (id == undefined || parent == undefined || data == undefined) {
        throw 'ID, Parent, Name are required field for a cube';
    }
    this.Id = id;
    this.ParentId = parent;
    this.Name = data.n;
    this.Color = data.c;
    this.Image = data.i;
    this.Meta = data.m;
    this.IsLeaf = data.l | false;
    this.Background = data.b || Utility.CubeBg;
    if (!Utility.IsNull(this.Image) && Utility.IsNull(this.Image.dim)) {
        this.Image.dim = Utility.ImageDimen;
    }

    this.Level = 0;
    this.LevelMaxNodes = 1;
    this.Depth = 0;
    this.TotalHeight = 0;

    this.Size = 1;
    this.Dimen = {
        width: Utility.MinCubeWidth,
        height: Utility.TextMargin
    };
    this.Span = 0;
    this.Lines = [];
    this.Children = [];
    this.Position = {
        x: Utility.CubeGap,
        y: Utility.LevelGap
    };

    //if having search, this is the Y position starting search area
    this.SeperatorY = 999999;

    //canvas context
    this.Context = null;
    this.OC = null;
}

//identify if a search event handler is set or not
Cube.prototype.HasSearch = function () {
    return !Utility.IsNull(this.OC.NodeSearch);
};

//identify whether a point is in the search area or not
Cube.prototype.IsInSearch = function (x, y) {
    y /= dpr;
    return this.HasSearch() && y > this.SeperatorY;
};

//add a child
Cube.prototype.AddChild = function (cube) {
    this.Children.push(cube);
};

//refresh level from current node
Cube.prototype.RefreshLevel = function () {
    var level = this.Level;
    return Utility.Each(this.Children, function (node) {
        node.Level = level + 1;
        return node.RefreshLevel();
    });
};

Cube.prototype.Count = function (dict) {
    if (Utility.IsNull(dict[this.Level])) {
        dict[this.Level] = 1;
    } else {
        dict[this.Level] += 1;
    }

    Utility.Each(this.Children, function (item) {
        item.Count(dict);
    });
};

//set level related info: Max nodes in a level, depth
Cube.prototype.SetLevelInfo = function () {
    var dict = {};
    this.Count(dict);

    var max = 1;
    var c = 1;
    for (var item in dict) {
        c++;
        if (dict[item] > max) {
            max = dict[item];
        }
    }
    this.LevelMaxNodes = max;
    this.Depth = c;
};

//return real span, sometimes width is bigger than span, so we should return width
Cube.prototype.RealSpan = function () {
    return Math.max(this.Span, this.Dimen.width);
};

//caculate my span
Cube.prototype.ComputeSpan = function () {
    //compute dimension firstly
    this.ComputeDimension();
    var span = 0;
    var size = 1;

    if (this.Children.length > 0) {
        span = (this.Children.length - 1) * Utility.CubeGap;
        for (var i = 0; i < this.Children.length; ++i) {
            span += this.Children[i].ComputeSpan();
            size += this.Children[i].Size;
        }
    }

    //return the span
    this.Size = size;
    this.Span = span;
    return this.RealSpan();
};

//compute text width
Cube.prototype.GetTextWidth = function (text) {
    return this.Context.measureText(text).width + 2 * Utility.TextMargin;
};

//caculate my dimension
Cube.prototype.ComputeDimension = function () {
    if (Utility.IsNull(this.Image)) {
        var textWidth = this.GetTextWidth(this.Name);
        if (textWidth < Utility.MaxCubeWidth) {
            this.AddLine(this.Name);
        } else {
            var words = this.Name.split(' ');
            var line = words[0];
            for (var i = 1; i < words.length; ++i) {
                if (this.GetTextWidth(line + ' ' + words[i]) >= Utility.MaxCubeWidth) {
                    this.AddLine(line);
                    line = words[i];
                } else {
                    line = line + ' ' + words[i];
                }
            }
            if (line.length > 0) {
                this.AddLine(line);
            }
        }
    } else {
        this.Dimen.width = this.Image.dim.width + 2 * Utility.TextMargin;
        this.Dimen.height = this.Image.dim.height + 2 * Utility.TextMargin;
        if (!Utility.IsNull(this.Image.text)) {
            var text = this.Image.text;
            var mw = 0;
            var mh = text.length * Utility.LineHeight + (text.length + 1) * Utility.TextMargin;
            for (var i = 0; i < text.length; ++i) {
                this.Lines.push(text[i]);
                var lw = this.GetTextWidth(text[i]);
                if (lw > mw) {
                    mw = lw;
                }
            }

            this.Dimen.width += mw + Utility.TextMargin;
            if (mh > this.Dimen.height) {
                this.Dimen.height = mh;
            }
        }
    }

    //add one extra line to put search command
    if (this.HasSearch()) {
        this.Dimen.height += 2 * Utility.TextMargin + Utility.LineHeight;
    }

    if (this.Dimen.height < Utility.MinCubeHeight) {
        this.Dimen.height = Utility.MinCubeHeight;
    }
};

//add one line of text to the cube
Cube.prototype.AddLine = function (line) {
    this.Lines.push(line);
    var textWidth = this.GetTextWidth(line);
    if (textWidth > this.Dimen.width) {
        this.Dimen.width = textWidth;
    }
    this.Dimen.height += Utility.LineHeight + Utility.TextMargin;
};

//in the tree, find a node whose id equals parameter
Cube.prototype.FindNode = function (id) {
    if (this.Id == id) return this;
    return Utility.Each(this.Children, function (node, idx) {
        return node.FindNode(id);
    });
};

//identify whether a position is inside me or not
Cube.prototype.ClickMe = function (x, y) {
    x /= dpr;
    y /= dpr;
    return x > this.Position.x && (x < this.Position.x + this.Dimen.width) &&
        y > this.Position.y && y < (this.Position.y + this.Dimen.height);
};

//Draw function to draw current node on canvas
Cube.prototype.Draw = function () {
    //draw the rectangle
    Utility.DrawRect(this.Context, this.Position, this.Dimen, this.Background);

    //content draw start point
    var sx = this.Position.x + Utility.TextMargin;
    var sy = this.Position.y + +Utility.TextMargin + Utility.LineHeight;

    //draw picture if have
    if (!Utility.IsNull(this.Image)) {
        var img = new Image();
        img.src = this.Image.src;
        img.cube = this;
        img.onload = function () {
            //this line will solve the quick render problem in canvas
            window.setTimeout("void()", "1000");
            //        this.cube.Context.drawImage(this, this.cube.Position.x, this.cube.Position.y, this.cube.Dimen.width, this.cube.Dimen.height);
            var dim = this.cube.Image.dim;
            if (Utility.IsNull(dim)) {
                dim = Utility.ImageDimen;
            }
            this.cube.Context.drawImage(this, this.cube.Position.x + Utility.TextMargin, this.cube.Position.y + Utility.TextMargin, dim.width, dim.height);
        };

        sx += this.Image.dim.width + Utility.TextMargin;
    }

    //draw each line of text to display
    for (var i = 0; i < this.Lines.length; ++i) {
        Utility.DrawText(this.Context, {
            x: sx,
            y: sy
        }, this.Lines[i], this.Color);
        sy += Utility.TextMargin + Utility.LineHeight;
    }

    //draw search area
    if (this.HasSearch()) {
        this.SeperatorY = this.Position.y + this.Dimen.height - 2 * Utility.TextMargin - Utility.LineHeight;
        Utility.DrawSeperator(this.Context, {
            x: this.Position.x + Utility.TextMargin,
            y: this.SeperatorY
        }, {
            x: this.Position.x + this.Dimen.width - Utility.TextMargin,
            y: this.SeperatorY
        });
        
        // search area display meta or default to search UI
        var text = this.Meta || Utility.SearchUI;
        Utility.DrawText(this.Context, {
            x: this.Position.x + this.Dimen.width - Utility.TextMargin - this.GetTextWidth(text),
            y: this.SeperatorY + Utility.LineHeight + Utility.TextMargin
        }, text, Utility.CommandColor);
    }

    //draw all children
    Utility.Each(this.Children, function (node) {
        return node.Draw();
    });

    //draw connections between me and my direct children
    if (this.Children.length > 0 && !this.IsLeaf) {
        //1. vertical down
        var start = {
            x: this.Position.x + this.Dimen.width / 2,
            y: this.Position.y + this.Dimen.height
        };
        Utility.DrawConnection(this.Context, start, {
            x: start.x,
            y: start.y + Utility.LevelGap / 2
        });

        //2. vertical for everyone
        for (var i = 0; i < this.Children.length; ++i) {
            var s = {
                x: this.Children[i].Position.x + this.Children[i].Dimen.width / 2,
                y: this.Children[i].Position.y
            };
            Utility.DrawConnection(this.Context, s, {
                x: s.x,
                y: s.y - Utility.LevelGap / 2
            });
        }

        //3. if having more than 1 children, draw a horizonal line to connect them all
        if (this.Children.length > 1) {
            var first = this.Children[0];
            var ss = {
                x: first.Position.x + first.Dimen.width / 2,
                y: first.Position.y - Utility.LevelGap / 2
            };
            var last = this.Children[this.Children.length - 1];
            var ee = {
                x: last.Position.x + last.Dimen.width / 2,
                y: last.Position.y - Utility.LevelGap / 2
            };
            Utility.DrawConnection(this.Context, ss, ee);
        }
    }

    return null;
};

/**
 * define the whole org chart to holds all lines/nodes
 * draw function is the final call to render it
 */
function OrgChart(cid) {
    this.CanvasId = cid;
    this.Canvas = document.getElementById(cid);
    this.Canvas2D = this.Canvas.getContext("2d");
    this.Canvas2D.font = Utility.Font;
    this.Cubes = [];
    this.LevelHeight = [];
    this.Final = null;
    this.NodeClick = null;
    this.NodeSearch = null;

    //set current orgchart object to OC so that we can reference it in 
    //the anonymous function to handl the click event
    var oc = this;
    this.Canvas.onmousemove = function (e) {
        if (Utility.IsFunction(oc.NodeClick) || Utility.IsFunction(oc.NodeSearch)) {
            if (e == undefined) {
                e = window.event;
            }
            var cube = oc.GetClickedCube(e.offsetX, e.offsetY);
            if (!Utility.IsNull(cube)) {
                document.body.style.cursor = "pointer";
            } else {
                document.body.style.cursor = "";
            }
        }
    };
    this.Canvas.onclick = function (e) {
        if (Utility.IsFunction(oc.NodeClick) || Utility.IsFunction(oc.NodeSearch)) {
            if (e == undefined) {
                e = window.event;
            }
            var cube = oc.GetClickedCube(e.offsetX, e.offsetY);
            if (!Utility.IsNull(cube)) {
                if (cube.IsInSearch(e.offsetX, e.offsetY)) {
                    oc.NodeSearch(cube.Id);
                } else if (Utility.IsFunction(oc.NodeClick)) {
                    oc.NodeClick(cube.Id);
                }
            }
        }
    };
}

//get clicked cube on a mouse click event
OrgChart.prototype.GetClickedCube = function (x, y) {
    //only search on this.Final
    if (!Utility.IsNull(this.Final)) {
        return Utility.SearchClickedOne(this.Final, x, y);
    }
    return null;
};


//add a new cube
OrgChart.prototype.Push = function (cube) {
    //0. set cavas context to the cube
    cube.Context = this.Canvas2D;
    cube.OC = this;

    //1. search sons firstly
    while (true) {
        var sonIdx = Utility.Each(this.Cubes, function (item, idx) {
            if (item.ParentId == cube.Id) {
                return idx;
            }
        });

        if (Utility.IsNull(sonIdx)) {
            break;
        }

        var item = this.Cubes.splice(sonIdx, 1)[0];
        cube.AddChild(item);
    }

    //2. search parent now
    var parent = Utility.Each(this.Cubes, function (item, idx) {
        return item.FindNode(cube.ParentId);
    });

    if (!Utility.IsNull(parent)) {
        parent.AddChild(cube);
    } else {
        //3. if we didn't find this guy's parent, we should push it to the list
        this.Cubes.push(cube);
    }
};

//layout a tree
//layout from this node, calculate all children's position, dimension.
//according to level, adjust the Y, according to sibling, adjust the X
OrgChart.prototype.Layout = function (root) {
    //0. max nodes on a level
    root.RefreshLevel();
    root.SetLevelInfo();
    Utility.MaxCubeWidth = root.Context.canvas.width / root.LevelMaxNodes;

    //1. calculate Span
    root.ComputeSpan();

    //according to span, reposition each node
    this.LevelHeight.length = 0;
    var q = [];
    q.push(root);
    this.LevelHeight.push(root.Dimen.height);

    //set root's x
    root.Position.x = root.RealSpan() / 2 - root.Dimen.width / 2;
    while (q.length > 0) {
        var top = q.shift();

        //calculate the max for current level
        if (top.Level == this.LevelHeight.length - 1) {
            if (top.Dimen.height > this.LevelHeight[this.LevelHeight.length - 1]) {
                this.LevelHeight[this.LevelHeight.length - 1] = top.Dimen.height;
            }
        } else {
            this.LevelHeight.push(top.Dimen.height);
        }

        //calculate all top's children's postion and push them to queue
        var cx = top.Position.x + top.Dimen.width / 2 - top.RealSpan() / 2;
        if (top.Dimen.width > top.Span) {
            cx += (top.Dimen.width - top.Span) / 2;
        }
        var cy = top.Position.y + top.Dimen.height + Utility.LevelGap;
        for (var i = 0; i < top.Children.length; ++i) {
            var child = top.Children[i];
            child.Position.x = cx + child.RealSpan() / 2 - child.Dimen.width / 2;
            //if the parent has only one son, let's make sure to align
            if (top.Children.length == 1) {

            }
            child.Position.y = cy;
            cx += child.RealSpan() + Utility.CubeGap;
            q.push(child);
        }
    }

    root.TotalHeight = Utility.LevelGap;
    for (var i = 0; i < this.LevelHeight.length; ++i) {
        root.TotalHeight += this.LevelHeight[i] + Utility.LevelGap;
    }
};

//draw functions
OrgChart.prototype.Draw = function () {
    //clear the client area to draw whole chart
    this.Canvas2D.clearRect(0, 0, this.Canvas.width, this.Canvas.height);
    var oc = this;
    //draw the whole org chart
    Utility.Each(this.Cubes, function (root) {
        oc.Layout(root);
        return null;
    });

    //select the final one to draw
    if (this.Cubes.length > 0) {
        this.Final = this.Cubes[0];
        for (var i = 1; i < this.Cubes.length; ++i) {
            if (this.Cubes[i].Size > this.Final.Size) {
                this.Final = this.Cubes[i];
            }
        }

        //set the final viewable canvas dimension
        this.Canvas.width = dpr * (this.Final.RealSpan() + 2 * Utility.CubeGap);
        this.Canvas.height = dpr * this.Final.TotalHeight;
        this.Canvas2D.scale(dpr, dpr);

        //draw the final one
        this.Final.Draw();
    }
};