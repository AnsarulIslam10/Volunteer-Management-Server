require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8ggzn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const volunteerPostCollection = client
      .db("volunteerDB")
      .collection("volunteerPosts");
    const volunteerRequestsCollection = client
      .db("volunteerDB")
      .collection("volunteerRequests");

    app.get("/all-posts", async (req, res) => {
      const search = req.query.search;
      let query = {
        title: {
          $regex: search,
          $options: "i",
        },
      };
      const result = await volunteerPostCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/post/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await volunteerPostCollection.findOne(query);
      res.send(result);
    });

    app.get("/my-posts", async (req, res) => {
      const { email } = req.query;
      const query = { "organizer.organizerEmail": email };
      const result = await volunteerPostCollection.find(query).toArray();
      res.send(result);
    });


    app.get('/update-my-post/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await volunteerPostCollection.findOne(query);
      res.send(result);
    })
    app.put('/update-my-post/:id', async(req, res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const options = {upsert: true}
      const updatedPost = req.body;
      const postData = {
        $set: {
          thumbnail: updatedPost.thumbnail,
          title: updatedPost.title,
          description: updatedPost.description,
          category: updatedPost.category,
          location: updatedPost.location,
          volunteersNumber: updatedPost.volunteersNumber,
          deadline: new Date(updatedPost.deadline)
        }
      }
      const result = await volunteerPostCollection.updateOne(filter, postData, options);
      res.send(result);
    })

    app.delete("/my-post/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await volunteerPostCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/add-post", async (req, res) => {
      const newPost = req.body;
      const result = await volunteerPostCollection.insertOne(newPost);
      res.send(result);
    });

    // volunteer needs now
    app.get("/volunteer-needs-now", async (req, res) => {
      const result = await volunteerPostCollection
        .find()
        .sort({ deadline: 1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.post("/volunteer-request", async (req, res) => {
      const volunteerInfo = req.body;
      const { email, postId } = volunteerInfo;

      try {
        const query = { email, postId };
        const alreadyExist = await volunteerRequestsCollection.findOne(query);
        console.log("If already exist-->", alreadyExist);

        if (alreadyExist) {
          return res
            .status(400)
            .send("You have already requested to volunteer for this post!");
        }

        const result = await volunteerRequestsCollection.insertOne(
          volunteerInfo
        );

        const filter = { _id: new ObjectId(postId) };
        const update = { $inc: { volunteersNumber: -1 } };
        const updatedVolunteerNumberPost = await volunteerPostCollection.updateOne(
          filter,
          update
        );
        const updatedVolunteerNumberRequest = await volunteerRequestsCollection.updateOne(
          {postId},
          update
        );


        if (updatedVolunteerNumberPost.modifiedCount === 0) {
          return res.status(500).send("Failed to update volunteer count.");
        }

        res.send(result);
      } catch (error) {
        console.log(error.message);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
