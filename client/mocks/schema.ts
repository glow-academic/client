// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 50,
    "userId": 26,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "mode": "mode_1",
    "idToken": "idToken_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 42,
    "userId": 43,
    "expires": "2025-07-25T19:17:52.222Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "cx2thnc6-atsr-28hl-r588-vmqa5ee677g",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": true,
    "fileId": "fileId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 69,
    "emailVerified": "2025-07-25T19:17:52.222Z"
  },
  {
    "id": 99,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-25T19:17:52.222Z",
    "image": "image_2"
  },
  {
    "id": 83,
    "email": "instructor@example.com",
    "emailVerified": "2025-07-25T19:17:52.222Z"
  },
  {
    "id": 74,
    "email": "ta@example.com",
    "emailVerified": "2025-07-25T19:17:52.222Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "tjnelfih-ws3b-t4sp-lwuv-rwkv4xkveir",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "userId": 69,
    "lastLogin": "2025-07-25T19:17:52.222Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-25T19:17:52.222Z"
  },
  {
    "id": "fmjc0reb-mabr-tv0h-f0r7-jtok8ysxacm",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "userId": 99,
    "lastLogin": "2025-07-25T19:17:52.222Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-25T19:17:52.222Z"
  },
  {
    "id": "ao7qk8ms-mfbx-zj1m-ay8f-lmz12u425u",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "userId": 83,
    "lastLogin": "2025-07-25T19:17:52.222Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-25T19:17:52.222Z"
  },
  {
    "id": "fouiu1mj-omg6-qjrc-krg0-fja2rkz0upr",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "lastLogin": "2025-07-25T19:17:52.222Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-25T19:17:52.222Z",
    "userId": 74
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "xqk6tdmf-2o96-izlz-zlpa-eeb9usa6jo",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "et9j8rof-3kqs-iuix-hfrx-vjoyhuerj2",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "k1ah58w6-sfj1-qy67-pr8h-9n5rpoo363",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 63,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "ugzxym76-yo12-i40p-d7vk-fklue4yr7aa",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 42,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "yuw4hzyf-euz6-je37-4x5f-y3au910ig5",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 83,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 17,
    "level": "level_1",
    "message": "message_1",
    "createdAt": "2025-07-25T19:17:52.222Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "eyrtiukh-451y-ojco-a30u-4l4vqnxw529",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 1,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 97,
    "createdAt": "2025-07-25T19:17:52.222Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "wpx636h0-5571-ojfu-y5hq-tswnt7eyzm",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "y3ceha2q-tfeo-wtvw-ni69-7o22m5tk8cx",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "63kdwwye-c79u-kv0m-711o-s096gzn286m",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "completedAt": "2025-07-25T19:17:52.222Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": true
  }
];

// PERSONAS MOCK DATA
export const personas = [
  {
    "id": "43xh727s-yin2-vpy4-vwj5-2ekrfqxfj6o",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.77,
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "modelId": "modelId_1",
    "reasoning": "low"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "6r9iyp3m-hvj0-i2zg-f85d-92hrzabdgdi",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.63,
    "modelId": "modelId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "1y0vilpq-lrah-m6ov-58az-ts9xuyusyn",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "classId": "classId_1",
    "deadlineId": "deadlineId_1",
    "timeId": "timeId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true,
    "parentId": "parentId_1",
    "active": true
  },
  {
    "id": "e3o1aub5-ah6j-iori-k4ju-5pq5xzuqm9p",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "personaId": "personaId_2",
    "crowdedness": 65,
    "locationId": "locationId_2",
    "deadlineId": "deadlineId_2",
    "timeId": "timeId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "active": false
  }
];

// SCENARIOCLASSES MOCK DATA
export const scenarioClasses = [
  {
    "id": "rqh9po5s-76ub-jz96-pulx-siiz3dcp5zr",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "name": "Scenario_classes 1",
    "classCode": "classCode_1",
    "description": "Description for scenario_classes 1"
  }
];

// SCENARIOLOCATIONS MOCK DATA
export const scenarioLocations = [
  {
    "id": "eyl9w42q-qqg0-ilzb-4qp1-nrxvka6knwh",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "name": "Scenario_locations 1",
    "description": "Description for scenario_locations 1"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "s5g2fm29-2bcb-qjl8-ud4c-zmbw4whc89",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "deadline": "deadline_1",
    "description": "Description for scenario_deadlines 1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "sm3yimlj-2zp7-swaw-m73z-n71mllunnk8",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "timeOfDay": "timeOfDay_1",
    "description": "Description for scenario_times 1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "f6fuetoh-blos-a4s4-brhn-dvfp4u8pwka",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "title": "Math Practice Simulation",
    "active": true,
    "scenarioIds": [
      "1y0vilpq-lrah-m6ov-58az-ts9xuyusyn",
      "e3o1aub5-ah6j-iori-k4ju-5pq5xzuqm9p"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "k0qg61y8-pvfi-0wce-6w39-bf9efjy017i",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "1y0vilpq-lrah-m6ov-58az-ts9xuyusyn",
      "e3o1aub5-ah6j-iori-k4ju-5pq5xzuqm9p"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "ns3o9pf5-3fee-9fwp-cd31-c7zilbxqixc",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "97m1uooq-psts-35hv-coty-0nf53andse0g",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "completedAt": "2025-07-25T19:17:52.222Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false,
    "traceId": "traceId_1"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "wzpqxz94-kr7z-a8sc-0f3u-4anhbq6i986",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "t5kevmaz-8p0e-3avp-dz7c-kzr3hbn66t",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "passed": true,
    "score": 24,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "jp99cqnf-2kvr-vcue-cchh-e1b37frurrc",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 11,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "kp8gwc9i-6hc1-xir7-bst2-wyj4nl5uyod",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "tjnelfih-ws3b-t4sp-lwuv-rwkv4xkveir",
      "fmjc0reb-mabr-tv0h-f0r7-jtok8ysxacm",
      "ao7qk8ms-mfbx-zj1m-ay8f-lmz12u425u",
      "fouiu1mj-omg6-qjrc-krg0-fja2rkz0upr"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "f6fuetoh-blos-a4s4-brhn-dvfp4u8pwka",
      "k0qg61y8-pvfi-0wce-6w39-bf9efjy017i"
    ]
  },
  {
    "id": "qgk0f54i-632e-gz0b-xwbh-ilm6lvw7gcl",
    "createdAt": "2025-07-25T19:17:52.222Z",
    "updatedAt": "2025-07-25T19:17:52.222Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "tjnelfih-ws3b-t4sp-lwuv-rwkv4xkveir",
      "fmjc0reb-mabr-tv0h-f0r7-jtok8ysxacm",
      "ao7qk8ms-mfbx-zj1m-ay8f-lmz12u425u",
      "fouiu1mj-omg6-qjrc-krg0-fja2rkz0upr"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "f6fuetoh-blos-a4s4-brhn-dvfp4u8pwka",
      "k0qg61y8-pvfi-0wce-6w39-bf9efjy017i"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-25T19:17:52.222Z",
    "token": "token_1"
  }
];

