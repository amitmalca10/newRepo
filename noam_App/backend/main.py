import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

app = FastAPI(title="NoamTrains API")

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
programs_collection = db.get_collection("programs")

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

class Exercise(BaseModel):
    name: str        
    sets: int        
    reps: int        
    rest: Optional[int] = None
    note: Optional[str] = None

class Day(BaseModel):
    id: int
    name: str
    exercises: List[Exercise] = []

class Program(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    name: str
    desc: Optional[str] = None
    level: str = "בינוני"
    sessionsPerWeek: int = 3
    days: List[Day] = []

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

@app.get("/programs", response_model=List[Program])
async def get_programs():
    programs = await programs_collection.find().to_list(100)
    return programs

@app.post("/programs", response_model=Program)
async def create_program(program: Program):
    new_program = await programs_collection.insert_one(program.dict(by_alias=True, exclude={"id"}))
    created_program = await programs_collection.find_one({"_id": new_program.inserted_id})
    return created_program