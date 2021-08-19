# orgchart
HTML5 canvas to draw organizational chart with JSON input / API build. 

<font color="purple">OrgChart is a JS library which draws org (organization) chart (tree) for your tree data.</font>

It requires HTML5 canvas.

#### **Example*1*:**

![Example 1](./orgchart1.png "example 1")


#### **Example*2* (images display, like name card):**
![Example 2](./orgchart2.png "example 2")

To see the source code sample, please go to [test file](./test/test.html)

Now, we have added the whole web site so that you can run the org chart service directly!
- In `~/src/ldap`, the data.py is utility to generate the org data in a compressed JSON blob.
- The `~/src/http` contains the simple web server provided by python, just run it.
- The `~/src/web` contians org chart web content, as long "http" can find these content.

