import os
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

app = FastAPI(title="FitCoach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URL = os.getenv("MONGO_URL", "mongodb+srv://amitmalca10_db_user:Am20012002@cluster0.yr6rbg3.mongodb.net/")
client = AsyncIOMotorClient(MONGO_URL)
db = client.noamtrains

# Collections
programs_collection = db.get_collection("programs")
trainers_collection = db.get_collection("trainers")
sessions_collection = db.get_collection("sessions")

# Custom ObjectId validation for Pydantic
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)
    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")

# --- Models ---
class Exercise(BaseModel):
    id: int
    name: str        
    sets: Optional[int] = None        
    reps: Optional[int] = None        
    rest: Optional[int] = None
    weight: Optional[str] = None
    note: Optional[str] = None

class Day(BaseModel):
    id: int
    name: str
    exercises: List[Exercise] = []

class ProgramModel(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    name: str
    desc: Optional[str] = ""
    level: str = "בינוני"
    sessionsPerWeek: int = 3
    days: List[Day] = []

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class TrainerModel(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    fname: str
    lname: str
    email: Optional[str] = ""
    phone: str
    password: str
    weight: Optional[str] = ""
    goal: Optional[str] = ""
    programId: Optional[str] = None # String to hold Program ID

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class SessionModel(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    trainerId: str
    date: str
    type: str

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# --- PROGRAMS ROUTES ---
@app.get("/programs", response_model=List[ProgramModel])
async def get_programs():
    return await programs_collection.find().to_list(100)

@app.post("/programs", response_model=ProgramModel)
async def create_program(program: ProgramModel):
    new_program = await programs_collection.insert_one(program.dict(by_alias=True, exclude={"id"}))
    return await programs_collection.find_one({"_id": new_program.inserted_id})

@app.put("/programs/{id}", response_model=ProgramModel)
async def update_program(id: str, program: ProgramModel):
    update_data = program.dict(by_alias=True, exclude={"id"}, exclude_unset=True)
    await programs_collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    return await programs_collection.find_one({"_id": ObjectId(id)})

@app.delete("/programs/{id}")
async def delete_program(id: str):
    await programs_collection.delete_one({"_id": ObjectId(id)})
    # Remove programId from associated trainers
    await trainers_collection.update_many({"programId": id}, {"$set": {"programId": None}})
    return {"status": "deleted"}


# --- TRAINERS ROUTES ---
@app.get("/trainers", response_model=List[TrainerModel])
async def get_trainers():
    return await trainers_collection.find().to_list(100)

@app.post("/trainers", response_model=TrainerModel)
async def create_trainer(trainer: TrainerModel):
    new_trainer = await trainers_collection.insert_one(trainer.dict(by_alias=True, exclude={"id"}))
    return await trainers_collection.find_one({"_id": new_trainer.inserted_id})

@app.put("/trainers/{id}")
async def update_trainer(id: str, data: dict = Body(...)):
    # Remove _id and id if they exist in the update body
    data.pop("_id", None)
    data.pop("id", None)
    await trainers_collection.update_one({"_id": ObjectId(id)}, {"$set": data})
    return {"status": "updated"}

@app.delete("/trainers/{id}")
async def delete_trainer(id: str):
    await trainers_collection.delete_one({"_id": ObjectId(id)})
    await sessions_collection.delete_many({"trainerId": id}) # Clean up sessions
    return {"status": "deleted"}


# --- SESSIONS ROUTES ---
@app.get("/sessions", response_model=List[SessionModel])
async def get_sessions():
    return await sessions_collection.find().to_list(1000)

@app.post("/sessions", response_model=SessionModel)
async def create_session(session: SessionModel):
    new_session = await sessions_collection.insert_one(session.dict(by_alias=True, exclude={"id"}))
    return await sessions_collection.find_one({"_id": new_session.inserted_id})