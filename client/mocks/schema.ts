// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "1jh5xzv9-3j7l-0yy1-s4oq-3oosbjumhao",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "f3h75tka-hp5e-aoh8-mnus-irtqrf04him",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
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
    "id": "5b5b7gav-pn6z-tllh-d6pa-r6mzd5c647",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": false,
    "classId": "classId_1"
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "yqkemvbc-j032-3vka-bmzl-b1md7xrbzv",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "9155550u-y03x-quvk-a19e-zdfx10lz9io",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "documentType": "documentType_1",
    "time": "2025-07-17T15:24:20.608Z",
    "scheduleId": "scheduleId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "hp2jjvfp-mwh3-ro4d-0gfj-bkbqh0db8qq",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": true,
    "fileId": "fileId_1"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "512ml7l1-icsr-mp9v-x93u-k62dv36vjy",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 54,
    "userId": 66,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "mode": "mode_1",
    "expiresAt": 2,
    "idToken": "idToken_1",
    "scope": "scope_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 18,
    "userId": 4,
    "expires": "2025-07-17T15:24:20.608Z",
    "sessionToken": "sessionToken_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "04biccdf-v3yy-q6iz-vud7-eb80ypk12lc",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 33,
    "name": "Admin User",
    "email": "admin@example.com"
  },
  {
    "id": 74,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "image": "image_2"
  },
  {
    "id": 30,
    "name": "Instructor User",
    "emailVerified": "2025-07-17T15:24:20.608Z",
    "image": "image_3"
  },
  {
    "id": 35,
    "email": "ta@example.com",
    "emailVerified": "2025-07-17T15:24:20.608Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "mmr6wr3w-fxv8-nnar-12ic-gv82rks2hti",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "userId": 33,
    "lastLogin": "2025-07-17T15:24:20.608Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "role": "admin",
    "classIds": [
      "1jh5xzv9-3j7l-0yy1-s4oq-3oosbjumhao",
      "f3h75tka-hp5e-aoh8-mnus-irtqrf04him"
    ],
    "active": true,
    "lastActive": "2025-07-17T15:24:20.608Z"
  },
  {
    "id": "jjs1eg91-yg9z-qzml-wpih-y9waju7ahji",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "userId": 74,
    "lastLogin": "2025-07-17T15:24:20.608Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "role": "instructional",
    "classIds": [
      "1jh5xzv9-3j7l-0yy1-s4oq-3oosbjumhao",
      "f3h75tka-hp5e-aoh8-mnus-irtqrf04him"
    ],
    "active": false,
    "lastActive": "2025-07-17T15:24:20.608Z"
  },
  {
    "id": "ei6uisey-uy4m-7410-dz31-sdj8ivt0fup",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "userId": 30,
    "lastLogin": "2025-07-17T15:24:20.608Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "role": "instructor",
    "classIds": [
      "1jh5xzv9-3j7l-0yy1-s4oq-3oosbjumhao",
      "f3h75tka-hp5e-aoh8-mnus-irtqrf04him"
    ],
    "active": false,
    "lastActive": "2025-07-17T15:24:20.608Z"
  },
  {
    "id": "byg5fxmi-e0o7-j4kz-oxou-m53xvvzfpx",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "userId": 35,
    "lastLogin": "2025-07-17T15:24:20.608Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "role": "ta",
    "classIds": [
      "1jh5xzv9-3j7l-0yy1-s4oq-3oosbjumhao",
      "f3h75tka-hp5e-aoh8-mnus-irtqrf04him"
    ],
    "active": false,
    "lastActive": "2025-07-17T15:24:20.608Z"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "r9ppgyae-knvx-5ewx-6u5v-rptiwnccuq",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 81,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "px68zhki-31g8-rkvv-1074-0dlx1kp7q0po",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 39,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "0kxvagc3-uhu7-mtbd-e50i-4srgb6hp0ki",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 54,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "fh13ky84-skvm-nf3y-4896-qkcfx5mxk6m",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 92,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 77,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-17T15:24:20.608Z"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 76,
    "createdAt": "2025-07-17T15:24:20.608Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "qi8k6pcd-d9dx-z699-ivqx-dx5xsh4o21i",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "k0agkwf2-tahy-f2kr-xior-8ke4bwksk5",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "classId": "classId_1",
    "seniority": "freshman",
    "location": "lawson",
    "tod": "9AM",
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true
  },
  {
    "id": "q6y9pnp3-a8b8-ctol-lj6m-65d9rh9s3ei",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "intensity": 65,
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
    "id": "mmiqio5s-ptha-ht7l-wr7r-zulrzucybn",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "7471o7vh-9g7e-ehxa-d4px-4lcyqddzfk6",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "completedAt": "2025-07-17T15:24:20.608Z",
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
    "id": "k4oosp3e-7oh6-0fd5-3110-m8gk5tqsx4k",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
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
    "id": "pz9k1876-h62y-oj5e-1j1f-ydawbbpmf1k",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.02,
    "defaultAgent": "defaultAgent_1",
    "editable": true
  },
  {
    "id": "plldnoa1-fqfy-r7hp-bfxu-ktlipma4mqp",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.11,
    "defaultAgent": "defaultAgent_2",
    "editable": true,
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "967v95ft-nyfb-ojyj-hgbp-xee5f61ji2b",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
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
    "id": "uxaqe4wx-btht-e73w-bthn-rxzhgxi2sn",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "mmr6wr3w-fxv8-nnar-12ic-gv82rks2hti",
      "jjs1eg91-yg9z-qzml-wpih-y9waju7ahji",
      "ei6uisey-uy4m-7410-dz31-sdj8ivt0fup",
      "byg5fxmi-e0o7-j4kz-oxou-m53xvvzfpx"
    ],
    "defaultCohort": "defaultCohort_1"
  },
  {
    "id": "n87bfw1r-r87o-jgev-d8ix-39tjrvu46rs",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "mmr6wr3w-fxv8-nnar-12ic-gv82rks2hti",
      "jjs1eg91-yg9z-qzml-wpih-y9waju7ahji",
      "ei6uisey-uy4m-7410-dz31-sdj8ivt0fup",
      "byg5fxmi-e0o7-j4kz-oxou-m53xvvzfpx"
    ],
    "defaultCohort": "defaultCohort_2"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "pi2c9hnl-qgv6-whv2-qrec-sutzlvkf9i",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "k0agkwf2-tahy-f2kr-xior-8ke4bwksk5",
      "q6y9pnp3-a8b8-ctol-lj6m-65d9rh9s3ei"
    ],
    "cohortIds": [
      "uxaqe4wx-btht-e73w-bthn-rxzhgxi2sn",
      "n87bfw1r-r87o-jgev-d8ix-39tjrvu46rs"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "1ltn6xwc-3f0i-yqhh-49ck-o85yq1e07qq",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "k0agkwf2-tahy-f2kr-xior-8ke4bwksk5",
      "q6y9pnp3-a8b8-ctol-lj6m-65d9rh9s3ei"
    ],
    "cohortIds": [
      "uxaqe4wx-btht-e73w-bthn-rxzhgxi2sn",
      "n87bfw1r-r87o-jgev-d8ix-39tjrvu46rs"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "2mb2kwkr-drom-ammd-f4d2-2qzrcat5e98",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "twmp8rjd-zf71-fufp-8q6n-s3tv4l5cpoq",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "completedAt": "2025-07-17T15:24:20.608Z",
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
    "id": "z52r1bqz-nf9b-n2sz-vzbo-7iqs1ju4jov",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "updatedAt": "2025-07-17T15:24:20.608Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "cr3z2qbl-q00t-5l79-kdhc-q0dkjh6ar1q",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "passed": true,
    "score": 27,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "heuuump7-qlcj-rm2r-xijg-lj4v6ddpeg",
    "createdAt": "2025-07-17T15:24:20.608Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 39,
    "feedback": "feedback_1"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-17T15:24:20.608Z",
    "token": "token_1"
  }
];

