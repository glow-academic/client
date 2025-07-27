// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 14,
    "userId": 85,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "mode": "mode_1",
    "expiresAt": 74,
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 18,
    "userId": 55,
    "expires": "2025-07-27T00:44:39.215Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "i26w8fz4-xurc-xo08-gj9y-dbq7dv9x44a",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": false,
    "fileId": "fileId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 39,
    "name": "Admin User",
    "email": "admin@example.com",
    "emailVerified": "2025-07-27T00:44:39.215Z"
  },
  {
    "id": 83,
    "name": "Instructional User"
  },
  {
    "id": 75,
    "email": "instructor@example.com",
    "emailVerified": "2025-07-27T00:44:39.215Z",
    "image": "image_3"
  },
  {
    "id": 76,
    "name": "TA User",
    "email": "ta@example.com",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "5jz8t09j-09tp-gmab-70k9-7q5uvxbnr0i",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "lastLogin": "2025-07-27T00:44:39.215Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-27T00:44:39.215Z",
    "userId": 39
  },
  {
    "id": "qqts1keg-hm7p-6tc1-iw4f-u81ticxcroa",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "userId": 83,
    "lastLogin": "2025-07-27T00:44:39.215Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-27T00:44:39.215Z"
  },
  {
    "id": "0shmpk51-0oyy-gaed-qzob-w8uqa9gyj98",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "lastLogin": "2025-07-27T00:44:39.215Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-27T00:44:39.215Z",
    "userId": 75
  },
  {
    "id": "jqconn0l-e1kh-impk-nu3h-zn9fccrhowh",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "lastLogin": "2025-07-27T00:44:39.215Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-27T00:44:39.215Z",
    "userId": 76
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "if2odh36-ov74-dfnb-tmxc-kpcpbs4c6en",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "2afkaa53-g568-6z2g-issr-4944575tmx3",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "y17rtco8-moph-ojuc-jywb-7lv9c6zepya",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 49,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "w6hucbyo-zghg-pyfc-6nlr-8j2qzv32a9a",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 50,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "1jpdhdnd-tqoe-gmw9-a6lv-zh8nbvxqn0s",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 65,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 58,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-27T00:44:39.215Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "za8in77k-nvev-s4m6-5pld-ee19bxxqof",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 62,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 67,
    "createdAt": "2025-07-27T00:44:39.215Z",
    "profileId": "profileId_1",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "k0egf5tc-15el-co35-gi6t-kf48ow29b1p",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "e4d10pg9-gkff-5fc0-wpsb-f1imohkvik9",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "completedAt": "2025-07-27T00:44:39.215Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "1tad66mr-rzcj-ur99-36v7-jxraf2lrjs",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
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
    "id": "mlb2787d-9hk7-6exw-7efs-2trkf6cub2d",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.59,
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "icon": "icon_1",
    "modelId": "modelId_1",
    "active": true
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "o0hjze4l-5w8w-i9hi-hgdg-tv53liij44i",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.42,
    "modelId": "modelId_1"
  },
  {
    "id": "4nhhyomf-csyl-cuzl-w5z9-1h5hu4dcqms",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.85,
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "h5ohct5s-wu9x-umor-4oh2-9g8yhxdsaut",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "simulationId": "simulationId_1"
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "0r0gtb68-cndt-1y86-5v71-c1max8378wt",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": true,
    "active": true
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "y1n1rysn-0ltb-6co4-b4pi-808u09nyqot",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "name": "Parameter_items 1",
    "description": "Description for parameter_items 1",
    "value": "value_1",
    "parameterId": "parameterId_1",
    "defaultItem": "defaultItem_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "gjkfk5n4-gi43-c7cv-xykn-n5fcg11yw1o",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "personaId": "personaId_1",
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
    "id": "hn696zuk-yovx-8yr6-gm17-zndfa7go04",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "personaId": "personaId_2",
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "parentId": "parentId_2",
    "active": false
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "kac4hptw-1mwe-3duj-d9je-v9rc9uch2cq",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true,
    "traceId": "traceId_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "4rhff0f5-x0zz-62r6-lv3i-jkldrrpx9hc",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "gjkfk5n4-gi43-c7cv-xykn-n5fcg11yw1o",
      "hn696zuk-yovx-8yr6-gm17-zndfa7go04"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "tj13gcht-y54b-eyab-m38q-czpy7q1hpe9",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "gjkfk5n4-gi43-c7cv-xykn-n5fcg11yw1o",
      "hn696zuk-yovx-8yr6-gm17-zndfa7go04"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "x3bms9b7-96eb-n7vu-ylzj-projzwus",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "6esz9lc5-pizc-3fcb-oiwl-6lby8fnff3p",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "passed": true,
    "score": 45,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "eg4o9x4u-k9nm-19wk-7550-wkucjt18xlo",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 94,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "a7mtch91-9fm0-jvpy-mdq6-sz8ppig31d",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "5jz8t09j-09tp-gmab-70k9-7q5uvxbnr0i",
      "qqts1keg-hm7p-6tc1-iw4f-u81ticxcroa",
      "0shmpk51-0oyy-gaed-qzob-w8uqa9gyj98",
      "jqconn0l-e1kh-impk-nu3h-zn9fccrhowh"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "4rhff0f5-x0zz-62r6-lv3i-jkldrrpx9hc",
      "tj13gcht-y54b-eyab-m38q-czpy7q1hpe9"
    ]
  },
  {
    "id": "1kidp4j1-n3gz-soej-z2ba-565b44hjt17",
    "createdAt": "2025-07-27T00:44:39.215Z",
    "updatedAt": "2025-07-27T00:44:39.215Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "5jz8t09j-09tp-gmab-70k9-7q5uvxbnr0i",
      "qqts1keg-hm7p-6tc1-iw4f-u81ticxcroa",
      "0shmpk51-0oyy-gaed-qzob-w8uqa9gyj98",
      "jqconn0l-e1kh-impk-nu3h-zn9fccrhowh"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "4rhff0f5-x0zz-62r6-lv3i-jkldrrpx9hc",
      "tj13gcht-y54b-eyab-m38q-czpy7q1hpe9"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-27T00:44:39.215Z",
    "token": "token_1"
  }
];

