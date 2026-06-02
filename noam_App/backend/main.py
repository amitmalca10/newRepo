import os
from dotenv import load_dotenv
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
load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client.noamtrains

# Collections
programs_collection = db.get_collection("programs")
trainers_collection = db.get_collection("trainers") # אוסף שמשמש כעת לכולם (מנהל ומתאמנים)
sessions_collection = db.get_collection("sessions")
saved_sets_collection = db.get_collection("saved_sets")

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
class LoginRequest(BaseModel):
    identifier: str
    password: str

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

class SavedSetModel(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    name: str
    exercises: List[Exercise] = []
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
    programId: Optional[str] = None
    role: Optional[str] = "user" # הוספת תפקיד (admin או user)
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

# --- STARTUP EVENT ---
@app.on_event("startup")
async def startup_event():
    # בודק אם כבר קיים אדמין במסד הנתונים
    admin = await trainers_collection.find_one({"role": "admin"})
    if not admin:
        # יצירת מנהל המערכת אוטומטית אם לא קיים
        admin_user = {
            "fname": "admin",
            "lname": "admin",
            "email": "admin@admin.com",
            "phone": "0501111111",
            "password": "Aa123456",
            "role": "admin"
        }
        await trainers_collection.insert_one(admin_user)
        print("✅ Admin user automatically created in DB.")

# --- LOGIN ROUTE ---
@app.post("/login")
async def login(req: LoginRequest):
    # חיפוש משתמש לפי אימייל, טלפון או שם משתמש
    user = await trainers_collection.find_one({
        "$or": [
            {"fname": req.identifier},
            {"email": req.identifier},
            {"phone": req.identifier}
        ]
    })
    
    if user and user.get("password") == req.password:
        role = user.get("role", "user")
        token = f"secure_token_{str(user['_id'])}" # ייצור טוקן פשוט להדגמה
        return {
            "success": True, 
            "token": token, 
            "role": role, 
            "name": user.get("fname"),
            "userId": str(user["_id"])
        }
    
    raise HTTPException(status_code=401, detail="שם משתמש או סיסמה שגויים")

# --- SAVED SETS ROUTES ---
@app.get("/saved_sets", response_model=List[SavedSetModel])
async def get_saved_sets():
    return await saved_sets_collection.find().to_list(100)

@app.post("/saved_sets", response_model=SavedSetModel)
async def create_saved_set(saved_set: SavedSetModel):
    new_set = await saved_sets_collection.insert_one(saved_set.dict(by_alias=True, exclude={"id"}))
    return await saved_sets_collection.find_one({"_id": new_set.inserted_id})

@app.put("/saved_sets/{id}", response_model=SavedSetModel)
async def update_saved_set(id: str, saved_set: SavedSetModel):
    if id == "undefined" or not id: raise HTTPException(status_code=400, detail="Invalid ID")
    update_data = saved_set.dict(by_alias=True, exclude={"id"}, exclude_unset=True)
    await saved_sets_collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    return await saved_sets_collection.find_one({"_id": ObjectId(id)})

@app.delete("/saved_sets/{id}")
async def delete_saved_set(id: str):
    if id == "undefined" or not id: raise HTTPException(status_code=400, detail="Invalid ID")
    await saved_sets_collection.delete_one({"_id": ObjectId(id)})
    return {"status": "deleted"}

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
    if id == "undefined" or not id: raise HTTPException(status_code=400, detail="Invalid ID")
    update_data = program.dict(by_alias=True, exclude={"id"}, exclude_unset=True)
    await programs_collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    return await programs_collection.find_one({"_id": ObjectId(id)})

@app.delete("/programs/{id}")
async def delete_program(id: str):
    if id == "undefined" or not id: raise HTTPException(status_code=400, detail="Invalid ID")
    await programs_collection.delete_one({"_id": ObjectId(id)})
    await trainers_collection.update_many({"programId": id}, {"$set": {"programId": None}})
    return {"status": "deleted"}

# --- TRAINERS ROUTES ---
@app.get("/trainers", response_model=List[TrainerModel])
async def get_trainers():
    # מחזיר רק מתאמנים רגילים, ללא האדמין
    return await trainers_collection.find({"role": {"$ne": "admin"}}).to_list(100)

@app.post("/trainers", response_model=TrainerModel)
async def create_trainer(trainer: TrainerModel):
    # כברירת מחדל מי שנוצר הוא user
    new_trainer = await trainers_collection.insert_one(trainer.dict(by_alias=True, exclude={"id"}))
    return await trainers_collection.find_one({"_id": new_trainer.inserted_id})

@app.put("/trainers/{id}")
async def update_trainer(id: str, data: dict = Body(...)):
    if id == "undefined" or not id: raise HTTPException(status_code=400, detail="Invalid ID")
    data.pop("_id", None)
    data.pop("id", None)
    await trainers_collection.update_one({"_id": ObjectId(id)}, {"$set": data})
    return {"status": "updated"}

@app.delete("/trainers/{id}")
async def delete_trainer(id: str):
    if id == "undefined" or not id: raise HTTPException(status_code=400, detail="Invalid ID")
    await trainers_collection.delete_one({"_id": ObjectId(id)})
    await sessions_collection.delete_many({"trainerId": id})
    return {"status": "deleted"}

# --- SESSIONS ROUTES ---
@app.get("/sessions", response_model=List[SessionModel])
async def get_sessions():
    return await sessions_collection.find().to_list(1000)

@app.post("/sessions", response_model=SessionModel)
async def create_session(session: SessionModel):
    new_session = await sessions_collection.insert_one(session.dict(by_alias=True, exclude={"id"}))
    return await sessions_collection.find_one({"_id": new_session.inserted_id})