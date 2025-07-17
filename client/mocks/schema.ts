// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "qewm9bku-j72p-jyuk-42ip-9fjq39wix9f",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "87gvdh8b-kxpl-89r7-7j51-784gh6rzhm",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2"
  }
];

// TOPICS MOCK DATA
export const topics = [
  {
    "id": "qaf5cutw-w5bs-jwsy-ck64-yrcu66borbh",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": false,
    "classId": "classId_1"
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "q5oiy1rm-qtz0-4cdi-bmrf-puvqw5ga7il",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "0ev3wp7w-yunx-3h28-b3v7-fhs8682jpqu",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "documentType": "documentType_1",
    "time": "2025-07-16T22:50:38.106Z",
    "scheduleId": "scheduleId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "jher14tx-0nlp-oaqc-nrge-y8tb8e2qbms",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": true
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "pbpksvl2-jnte-ihae-p3tu-737k1t941mq",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 86,
    "userId": 41,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 54,
    "idToken": "idToken_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 38,
    "userId": 47,
    "expires": "2025-07-16T22:50:38.106Z",
    "sessionToken": "sessionToken_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "6uj56kta-vj7s-dr2p-w4n9-l8f5zoty3u",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 53,
    "name": "Admin User",
    "emailVerified": "2025-07-16T22:50:38.106Z"
  },
  {
    "id": 21,
    "emailVerified": "2025-07-16T22:50:38.106Z",
    "image": "image_2"
  },
  {
    "id": 79,
    "emailVerified": "2025-07-16T22:50:38.106Z",
    "image": "image_3"
  },
  {
    "id": 91,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-07-16T22:50:38.106Z"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "8h84aosa-ipff-bj1q-6vx9-xpgo2c15vt",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "lastLogin": "2025-07-16T22:50:38.106Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "role": "admin",
    "classIds": [
      "qewm9bku-j72p-jyuk-42ip-9fjq39wix9f",
      "87gvdh8b-kxpl-89r7-7j51-784gh6rzhm"
    ],
    "active": true,
    "lastActive": "2025-07-16T22:50:38.106Z",
    "userId": 53
  },
  {
    "id": "npaqegz4-oovg-agax-ibv0-6ivtbdtna3d",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "userId": 21,
    "lastLogin": "2025-07-16T22:50:38.106Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "role": "instructional",
    "classIds": [
      "qewm9bku-j72p-jyuk-42ip-9fjq39wix9f",
      "87gvdh8b-kxpl-89r7-7j51-784gh6rzhm"
    ],
    "active": false,
    "lastActive": "2025-07-16T22:50:38.106Z"
  },
  {
    "id": "trd7ct78-r8nf-et68-h1od-hf3tqr79gsi",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "userId": 79,
    "lastLogin": "2025-07-16T22:50:38.106Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "role": "instructor",
    "classIds": [
      "qewm9bku-j72p-jyuk-42ip-9fjq39wix9f",
      "87gvdh8b-kxpl-89r7-7j51-784gh6rzhm"
    ],
    "active": false,
    "lastActive": "2025-07-16T22:50:38.106Z"
  },
  {
    "id": "zxyccxbh-lszn-7nvr-rkf1-yaqj1ues6i9",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "userId": 91,
    "lastLogin": "2025-07-16T22:50:38.106Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "role": "ta",
    "classIds": [
      "qewm9bku-j72p-jyuk-42ip-9fjq39wix9f",
      "87gvdh8b-kxpl-89r7-7j51-784gh6rzhm"
    ],
    "active": false,
    "lastActive": "2025-07-16T22:50:38.106Z"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "1kn5o7ws-hhgs-8ubf-2efa-mmy6joch5mq",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 6,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "9ql1n5uu-29y7-3c75-zlxd-alq1i32qdr",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 52,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "tfbd1umy-o3yr-8h4o-bktu-4cp9jkmeq4t",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 91,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "u8wb3xgc-cudl-okv3-s5xy-vbukcpeosnj",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 97,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 40,
    "level": "level_1",
    "message": "message_1",
    "createdAt": "2025-07-16T22:50:38.106Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 64,
    "createdAt": "2025-07-16T22:50:38.106Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "h692g91o-x4np-r5l4-g90x-niohflk1zf",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "uocnbsnk-82hp-zpqh-xcrd-9i9qkks5n",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "classId": "classId_1",
    "crowdedness": 4,
    "intensity": 97,
    "seniority": "freshman",
    "location": "lawson",
    "urgency": "hour",
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": false
  },
  {
    "id": "7ycoo9r2-tfjz-mjek-2du3-e7tdaw85wp",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "classId": "classId_2",
    "intensity": 53,
    "seniority": "sophomore",
    "location": "haas",
    "tod": "10AM",
    "urgency": "day",
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": true
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "oj3jn50g-y6g1-uqyy-czii-6wjz2a2zg17",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "completedAt": "2025-07-16T22:50:38.106Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "7jpbhmnd-knpc-kgh7-5mk9-6sqw26onvni",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "completedAt": "2025-07-16T22:50:38.106Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": false
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "62gz7bl0-ba5o-wp44-anu5-m1k1m3zc9sa",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": true,
    "defaultComponent": "defaultComponent_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "o55qu36n-bt0t-ieua-dw6l-jyn3y0w76f",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.01,
    "defaultAgent": "defaultAgent_1",
    "editable": false,
    "modelId": "modelId_1",
    "reasoning": "low"
  },
  {
    "id": "vh1mjsr0-2ps3-yyep-4e8p-q5q00k0e85i",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.65,
    "defaultAgent": "defaultAgent_2",
    "editable": false,
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "olqt904n-jsdb-c2qs-66ot-tjn0ophonrf",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "profileId": "profileId_1",
    "headerComponentIds": [
      "headerComponentIds_1"
    ],
    "primaryComponentIds": [
      "primaryComponentIds_1"
    ],
    "secondaryComponentIds": [
      "secondaryComponentIds_1"
    ],
    "footerComponentIds": [
      "footerComponentIds_1"
    ],
    "autoScroll": "autoScroll_1",
    "showIndicators": "showIndicators_1",
    "headerComponents": "headerComponents_1",
    "mainSplit": "mainSplit_1",
    "footerSplit": "footerSplit_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "0dze6ldq-cyqc-xfdd-3vvp-didph208bl",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "8h84aosa-ipff-bj1q-6vx9-xpgo2c15vt",
      "npaqegz4-oovg-agax-ibv0-6ivtbdtna3d",
      "trd7ct78-r8nf-et68-h1od-hf3tqr79gsi",
      "zxyccxbh-lszn-7nvr-rkf1-yaqj1ues6i9"
    ],
    "defaultCohort": "defaultCohort_1"
  },
  {
    "id": "d95wvk8r-ajev-xxze-ev4f-ftynb7zivzi",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "8h84aosa-ipff-bj1q-6vx9-xpgo2c15vt",
      "npaqegz4-oovg-agax-ibv0-6ivtbdtna3d",
      "trd7ct78-r8nf-et68-h1od-hf3tqr79gsi",
      "zxyccxbh-lszn-7nvr-rkf1-yaqj1ues6i9"
    ],
    "defaultCohort": "defaultCohort_2"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "vs6eum7a-ndjs-hubv-yo9h-nxs9x88rqk",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "uocnbsnk-82hp-zpqh-xcrd-9i9qkks5n",
      "7ycoo9r2-tfjz-mjek-2du3-e7tdaw85wp"
    ],
    "cohortIds": [
      "0dze6ldq-cyqc-xfdd-3vvp-didph208bl",
      "d95wvk8r-ajev-xxze-ev4f-ftynb7zivzi"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "daog8nv7-jlw9-80de-ebuf-m3b02jsktyl",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "uocnbsnk-82hp-zpqh-xcrd-9i9qkks5n",
      "7ycoo9r2-tfjz-mjek-2du3-e7tdaw85wp"
    ],
    "cohortIds": [
      "0dze6ldq-cyqc-xfdd-3vvp-didph208bl",
      "d95wvk8r-ajev-xxze-ev4f-ftynb7zivzi"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "qr6erhw4-p1md-7z9d-arv5-ylur7aafx3l",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "o8n693e9-0wbe-xcdj-kdch-jagz4bo2lu",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true,
    "traceId": "traceId_1"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "yqhq99k3-xoww-ehc9-l5hf-y1bd7egv79",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "updatedAt": "2025-07-16T22:50:38.106Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "6ct0yj5j-rzrm-6wqm-a6gs-d9jgny5jlo",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "passed": false,
    "score": 33,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "3gnbp8bn-z8nz-rpch-3kx5-4p0eg25qpdu",
    "createdAt": "2025-07-16T22:50:38.106Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 50,
    "feedback": "feedback_1"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-16T22:50:38.106Z",
    "token": "token_1"
  }
];

