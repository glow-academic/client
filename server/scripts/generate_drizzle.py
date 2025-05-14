# server/scripts/generate_drizzle.py
# WIP, still does not work all the way
import inspect
import os
from app.models import User, Chat, Message, Rubric, ChatProfile

def generate_drizzle_schema():
    """Generate Drizzle schema from SQLModel classes"""
    output = """import {
    pgTable,
    uuid,
    timestamp,
    text,
    boolean as pgBoolean,
    integer,
    pgEnum,
    numeric,
} from "drizzle-orm/pg-core";

// reuse the DB enum
export const chatProfile = pgEnum("chat_profile", [
    "aggressive",
    "shy",
    "happy",
]);
"""
    
    # Generate schema for each model
    models = [User, Chat, Message, Rubric]
    for model in models:
        table_name = model.__tablename__
        output += f"\nexport const {table_name} = pgTable(\"{table_name}\", {{\n"
        
        for name, field in inspect.get_annotations(model).items():
            # Skip SQLModel internal fields
            if name.startswith("_"):
                continue
                
            # Generate field definition based on type
            if name == "id" and "primary_key=True" in str(getattr(model, "__annotations__", {}).get(name, "")):
                output += f"    {name}: uuid(\"{name}\").defaultRandom().primaryKey(),\n"
            elif name == "created_at":
                output += f"    {name}: timestamp(\"{name}\").defaultNow().notNull(),\n"
            # Add more field type mappings as needed
            
        output += "});\n"
    
    # Write to file
    os.makedirs("client/drizzle", exist_ok=True)
    with open("client/drizzle/schema.ts", "w") as f:
        f.write(output)
    
    print("Drizzle schema generated successfully!")

if __name__ == "__main__":
    generate_drizzle_schema() 