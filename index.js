import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import express from 'express';
import cors from 'cors';
import "dotenv/config";

// define app
const app = express();
const port = 5000;
// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.2trpp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
        // create a database collection
        const assignmentDatabase = await client.db("assignment7").createCollection("assignments");
        const submitedAssignmentDatabase = await client.db("assignment7").createCollection("submitAssignments");

        // test route
        app.get("/", (req, res) => {
            res.status(200).send({
                success: true,
                message: "Welcome to assignment7 API",
                data: null
            })
        })

        // create a assignment
        app.post("/create-assignment", async (req, res) => {
            const assignment = req.body;
            const result = await assignmentDatabase.insertOne(assignment);
            res.status(201).send({
                success: true,
                message: "Assignment created successfully",
                data: result
            })
        })

        // get all assignments
        app.get("/assignments", async (req, res) => {
            const assignments = await assignmentDatabase.find().toArray();
            res.status(200).send({
                success: true,
                message: "Assignments retrieved successfully",
                data: assignments
            })
        })

        // delete a assignment
        app.delete("/delete-assignment/:email/:id", async (req, res) => {
            const { email, id } = req?.params;
            const deletedData = await assignmentDatabase.findOne({ _id: new ObjectId(id) });

            if (!deletedData) {
                return res.status(404).send({
                    success: false,
                    message: "Assignment not found",
                    data: null,
                });
            }

            // Check valid user
            if (deletedData?.createdBy?.email !== email) {
                return res.status(403).send({
                    success: false,
                    message: "You are not authorized to delete this assignment",
                    data: null,
                });
            }

            // Delete the assignment
            const result = await assignmentDatabase.deleteOne({ _id: new ObjectId(id) });

            return res.status(200).send({
                success: true,
                message: "Assignment deleted successfully",
                data: result,
            });
        })

        // update a assignment
        app.put("/update-assignment/:email/:id", async (req, res) => {
            const { email, id } = req?.params;
            const assignment = req.body;
            const updatedData = await assignmentDatabase.findOne({ _id: new ObjectId(id) });

            if (!updatedData) {
                return res.status(404).send({
                    success: false,
                    message: "Assignment not found",
                    data: null,
                });
            }

            // Check valid user
            if (updatedData?.createdBy?.email !== email) {
                return res.status(403).send({
                    success: false,
                    message: "You are not authorized to update this assignment",
                    data: null,
                });
            }

            // Update the assignment
            const result = await assignmentDatabase.updateOne({ _id: new ObjectId(id) }, { $set: assignment });

            return res.status(200).send({
                success: true,
                message: "Assignment updated successfully",
                data: result,
            });
        })


        // submit a assingmet
        app.post("/submit-assignment/:email", async (req, res) => {
            const submittedAt = new Date();
            const { email } = req?.params;
            const assignment = req.body;
            const result = await submitedAssignmentDatabase.insertOne({ ...assignment, status: "pending", submittedBy: email, submittedAt });
            res.status(201).send({
                success: true,
                message: "Assignment submitted successfully",
                data: result
            })
        })

        app.get("/user-assignments/:email", async (req, res) => {
            const { email } = req?.params;
            if (!email) {
                return res.status(400).send({
                    success: false,
                    message: "Invalid email address provided",
                    data: null,
                });
            }
            const assignments = await submitedAssignmentDatabase
                .aggregate([
                    { $match: { submittedBy: email } },
                    { $addFields: { assignmentId: { $toObjectId: "$assignmentId" } } },
                    {
                        $lookup: {
                            from: "assignments",
                            localField: "assignmentId",
                            foreignField: "_id",
                            as: "assignmentDetails",
                        },
                    },
                ]).toArray();

            if (!assignments || assignments.length === 0) {
                return res.status(404).send({
                    success: false,
                    message: "No assignments found for this user",
                    data: [],
                });
            }

            res.status(200).send({
                success: true,
                message: "Assignments retrieved successfully",
                data: assignments,
            });

        }
        );

        app.get("/pending-assignments", async (req, res) => {

            const assignments = await submitedAssignmentDatabase
                .aggregate([
                    { $match: { status: {$ne:"completed"} } },
                    { $addFields: { assignmentId: { $toObjectId: "$assignmentId" } } },
                    {
                        $lookup: {
                            from: "assignments",
                            localField: "assignmentId",
                            foreignField: "_id",
                            as: "assignmentDetails",
                        },
                    },
                ]).toArray();

            if (!assignments || assignments.length === 0) {
                return res.status(404).send({
                    success: false,
                    message: "No pending assignments found ",
                    data: [],
                });
            }

            res.status(200).send({
                success: true,
                message: "Assignments retrieved successfully",
                data: assignments,
            });

        }
        );

        // update mark and status
        app.patch("/assgnment-mark/:email/:id", async (req, res) => {
            const { email, id } = req?.params;
            const assignment = req.body;
            const updatedData = await submitedAssignmentDatabase.findOne({ _id: new ObjectId(id) });

            if (!updatedData) {
                return res.status(404).send({
                    success: false,
                    message: "Assignment not found",
                    data: null,
                });
            }

            // Check valid user
            if (updatedData?.submittedBy == email) {
                return res.status(403).send({
                    success: false,
                    message: "You can't marked on your own assignment",
                    data: null,
                });
            }

            // Update the assignment
            const result = await submitedAssignmentDatabase.updateOne({ _id: new ObjectId(id) }, { $set: { ...assignment, examiner: email, status: "completed" } });

            return res.status(200).send({
                success: true,
                message: "Assignment updated successfully",
                data: result,
            });
        })


    } finally {
        app.listen(port, () => {
            console.log(`Example app listening on port ${port}`)
        })
    }
}
run().catch(console.dir);