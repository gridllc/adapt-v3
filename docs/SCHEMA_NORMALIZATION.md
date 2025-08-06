# Database Schema Normalization

## ✅ **Schema Improvements Implemented**

### 1. **Enhanced Relationships**
- **Proper Foreign Keys**: All relationships now have explicit foreign key constraints
- **Cascade Deletes**: Related data is properly cleaned up when parent records are deleted
- **Referential Integrity**: Database enforces relationship constraints

### 2. **Step Model Improvements**
- **Better Time Tracking**: Changed from `timestamp` to `startTime` and `endTime`
- **Unique Constraints**: Added `@@unique([moduleId, order])` to prevent duplicate step orders
- **Improved Data Structure**: Clear start/end times for better video navigation

### 3. **Module Model Enhancements**
- **Performance Indexes**: Added indexes on `status`, `userId`, and `createdAt`
- **Complete Relations**: All related models now properly reference Module
- **Status Standardization**: Changed `completed` to `ready` for consistency

### 4. **Question Model Optimizations**
- **Performance Indexes**: Added indexes on `moduleId`, `stepId`, and `isFAQ`
- **Proper Relations**: Questions can reference both Module and Step
- **Flexible Structure**: Optional step references for general questions

## 🔧 **Schema Changes**

### **Module Model**
```prisma
model Module {
  id          String   @id @default(cuid())
  title       String
  filename    String
  videoUrl    String
  status      String   @default("processing") // processing, ready, failed, orphaned
  progress    Int      @default(0)
  userId      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  steps       Step[]
  feedbacks   Feedback[]
  statuses    ModuleStatus[]
  questions   Question[]
  aiInteractions AIInteraction[]
  trainingSessions TrainingSession[]
  
  @@index([status])
  @@index([userId])
  @@index([createdAt])
  @@map("modules")
}
```

### **Step Model**
```prisma
model Step {
  id          String   @id @default(cuid())
  moduleId    String
  startTime   Int      // Video start timestamp in seconds
  endTime     Int      // Video end timestamp in seconds
  title       String
  description String
  duration    Int      // Duration in seconds
  order       Int      // Step order in sequence
  createdAt   DateTime @default(now())
  
  // Relations
  module      Module   @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  questions   Question[]
  
  @@unique([moduleId, order])
  @@map("steps")
}
```

### **Question Model**
```prisma
model Question {
  id        String   @id @default(cuid())
  moduleId  String
  stepId    String?
  question  String
  answer    String
  videoTime Float?
  isFAQ     Boolean  @default(false)
  userId    String?
  createdAt DateTime @default(now())
  
  // Relations
  module    Module   @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  step      Step?    @relation(fields: [stepId], references: [id], onDelete: SetNull)
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  vector    QuestionVector?
  
  @@index([moduleId])
  @@index([stepId])
  @@index([isFAQ])
  @@map("questions")
}
```

## 🧹 **Data Cleanup Features**

### **Orphaned Data Detection**
- **Questions without Modules**: Automatically removed
- **Questions with Invalid Steps**: Step references cleared
- **Steps without Modules**: Automatically removed
- **Feedback without Modules**: Automatically removed
- **Status entries without Modules**: Automatically removed
- **AI Interactions without Modules**: Automatically removed
- **Training Sessions without Modules**: Automatically removed

### **Data Migration**
- **Timestamp Conversion**: Old `timestamp` fields converted to `startTime`/`endTime`
- **Status Updates**: `completed` status changed to `ready`
- **User Reference Validation**: Modules without users are tracked (normal for anonymous uploads)

## 📊 **Performance Improvements**

### **Database Indexes**
- **Module Status**: Fast filtering by status
- **Module User**: Quick user-based queries
- **Module Creation**: Efficient date-based sorting
- **Question Module**: Fast module-based question queries
- **Question Step**: Efficient step-based filtering
- **Question FAQ**: Quick FAQ filtering
- **Step Order**: Unique constraint prevents duplicate orders

### **Query Optimization**
- **Eager Loading**: Related data loaded efficiently
- **Cascade Deletes**: Automatic cleanup prevents orphaned data
- **Proper Joins**: Optimized relationship queries

## 🔄 **Migration Process**

### **Migration Script** (`backend/scripts/migrate-schema.js`)
1. **Generate Prisma Client**: Updates client with new schema
2. **Create Migration**: Applies schema changes to database
3. **Clean Orphaned Data**: Removes invalid references
4. **Update Existing Data**: Converts old data to new format

### **Commands**
```bash
# Run the migration script
node backend/scripts/migrate-schema.js

# Or manually run the steps
npx prisma generate
npx prisma migrate dev --name normalize-relations
```

## 🚀 **Benefits**

### **Data Integrity**
- **Referential Integrity**: Database enforces relationships
- **No Orphaned Data**: Automatic cleanup prevents data inconsistencies
- **Consistent Status Values**: Standardized status tracking

### **Performance**
- **Faster Queries**: Indexes improve query performance
- **Efficient Joins**: Proper relationships enable optimized queries
- **Reduced Storage**: Cleanup removes unnecessary data

### **Developer Experience**
- **Type Safety**: Better TypeScript support with proper relations
- **Clear Structure**: Intuitive data model relationships
- **Easy Maintenance**: Consistent patterns across all models

## 📝 **Usage Examples**

### **Creating Steps**
```typescript
// Old way
await DatabaseService.createSteps(moduleId, [
  { timestamp: 0, title: "Start", description: "...", duration: 30 }
])

// New way (automatically converted)
await DatabaseService.createSteps(moduleId, [
  { timestamp: 0, title: "Start", description: "...", duration: 30 }
  // Internally creates: startTime: 0, endTime: 30
])
```

### **Querying with Relations**
```typescript
// Get module with all related data
const module = await prisma.module.findUnique({
  where: { id: moduleId },
  include: {
    steps: { orderBy: { order: 'asc' } },
    questions: { include: { step: true } },
    user: true
  }
})
```

## 🎯 **Next Steps**

1. **Run Migration**: Execute the migration script
2. **Test Relations**: Verify all relationships work correctly
3. **Monitor Performance**: Check query performance improvements
4. **Update Documentation**: Update API documentation with new structure
5. **Backup Data**: Ensure data is backed up before migration

---

**Status**: ✅ **Schema Normalized and Ready for Migration** 