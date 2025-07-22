// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 58,
    "userId": 65,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 17,
    "idToken": "idToken_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 50,
    "userId": 33,
    "expires": "2025-07-22T14:42:32.090Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "p936cxhr-vwjp-qszb-5rne-88oble998mg",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": false,
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 79,
    "name": "Admin User",
    "email": "admin@example.com",
    "emailVerified": "2025-07-22T14:42:32.090Z",
    "image": "image_1"
  },
  {
    "id": 91,
    "name": "Instructional User",
    "emailVerified": "2025-07-22T14:42:32.090Z",
    "image": "image_2"
  },
  {
    "id": 11,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "image": "image_3"
  },
  {
    "id": 11,
    "name": "TA User",
    "email": "ta@example.com",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "1y2ckmej-x7zr-yedk-7b9s-amt4o6f62t",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "userId": 79,
    "lastLogin": "2025-07-22T14:42:32.090Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-22T14:42:32.090Z"
  },
  {
    "id": "857vebk2-dgcg-gem5-2i58-eyow15sh4wn",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "userId": 91,
    "lastLogin": "2025-07-22T14:42:32.090Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-22T14:42:32.090Z"
  },
  {
    "id": "l3jdcis6-l8br-70rr-oyzu-2g4eq2w9jn",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "userId": 11,
    "lastLogin": "2025-07-22T14:42:32.090Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-22T14:42:32.090Z"
  },
  {
    "id": "pqp93csx-q9mk-2rnp-dpi4-9jeazplb1ie",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "userId": 11,
    "lastLogin": "2025-07-22T14:42:32.090Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-22T14:42:32.090Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "35jt8t33-tyvl-dfl0-xwr1-hl0eutmzz0t",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "szkfzbpn-miwb-t3mm-5o75-6brnoypgps3",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "jxn9wtj3-dvci-0k65-0nhb-ohdwh9c2yj8",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 33,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "06d4wh6f-spwc-9e0b-8hii-cgqyz97iyho",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 72,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "ja0yczl2-0bmm-5b52-4a0v-uy9cq57ef0i",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 10,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 12,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-22T14:42:32.090Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "lufjm8fo-uumo-fw3t-r454-i6cfigxdbfb",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 81,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 80,
    "createdAt": "2025-07-22T14:42:32.090Z",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "gjzf9dla-7pzw-tt6v-5i5k-u7wp94abwir",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "6uqs3n6j-9yyo-kguq-npdo-3awonaw89qc",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "uzclfqmi-xve4-qca1-t97i-fi1yj0jgxcr",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "completedAt": "2025-07-22T14:42:32.090Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": true
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "9a5nysfg-6t90-dnkj-03wv-op8zv8opslo",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": false,
    "defaultComponent": "defaultComponent_1"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "pbx59cgx-9wr0-v4ba-gra9-k7nb93hkdqq",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
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

// PERSONAS MOCK DATA
export const personas = [
  {
    "id": "m0k4qgyd-sl4t-znqm-iv1l-uu16oxd0cig",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.53,
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "reasoning": "low"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "3h9q7s34-9es5-nzsq-l2rb-jxn3xqege2n",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.32,
    "modelId": "modelId_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "5jblwb2h-c6qp-9i6y-b2by-aw6x4mtfimn",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "personaId": "personaId_1",
    "crowdedness": 39,
    "classId": "classId_1",
    "locationId": "locationId_1",
    "timeId": "timeId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": false,
    "parentId": "parentId_1",
    "active": true
  },
  {
    "id": "d2re4eoh-swwj-w6qk-ed4k-bamxr9uq7fe",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "personaId": "personaId_2",
    "classId": "classId_2",
    "locationId": "locationId_2",
    "timeId": "timeId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "parentId": "parentId_2",
    "active": false
  }
];

// SCENARIOCLASSES MOCK DATA
export const scenarioClasses = [
  {
    "id": "1el1mhdo-ksbb-9w8p-v78l-v58pems7itj",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "name": "Scenario_classes 1",
    "classCode": "classCode_1",
    "description": "Description for scenario_classes 1"
  }
];

// SCENARIOLOCATIONS MOCK DATA
export const scenarioLocations = [
  {
    "id": "i4qlfde6-kywl-tawi-f1vv-q7nriozaek8",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "name": "Scenario_locations 1",
    "description": "Description for scenario_locations 1"
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "wxdsydna-i9ya-dx92-yft0-pm2bu1jn8g",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "deadline": "deadline_1",
    "description": "Description for scenario_deadlines 1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "hnkzarbd-j4gg-u9t0-ao7t-7on740uo5iu",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "timeOfDay": "timeOfDay_1",
    "description": "Description for scenario_times 1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "q2a9o63o-4x2m-iqdl-bgcf-1krmybs8a06",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "title": "Math Practice Simulation",
    "active": true,
    "scenarioIds": [
      "5jblwb2h-c6qp-9i6y-b2by-aw6x4mtfimn",
      "d2re4eoh-swwj-w6qk-ed4k-bamxr9uq7fe"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "phtrvvuf-i1z4-rpal-95t6-k0wbkdi1w3",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "title": "Lab Safety Training",
    "active": false,
    "scenarioIds": [
      "5jblwb2h-c6qp-9i6y-b2by-aw6x4mtfimn",
      "d2re4eoh-swwj-w6qk-ed4k-bamxr9uq7fe"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "ph5d6m3q-bzs8-j856-knrc-ws5g1tq53vg",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "o6wqnef3-spuz-j1uu-xl8r-5c1cd6c1azq",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "completedAt": "2025-07-22T14:42:32.090Z",
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
    "id": "8xgcrrkv-0gev-q3kr-y85n-4dj54vwfhvx",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "1uay40gp-sq6u-0y3g-8ep7-vd02gyi2ne",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "passed": false,
    "score": 83,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "37z0mt8q-rcfv-u828-zj7y-2v3kcnb9dkv",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 52,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "57esuf06-y9qw-wr43-wumu-p7olq4qrozq",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "1y2ckmej-x7zr-yedk-7b9s-amt4o6f62t",
      "857vebk2-dgcg-gem5-2i58-eyow15sh4wn",
      "l3jdcis6-l8br-70rr-oyzu-2g4eq2w9jn",
      "pqp93csx-q9mk-2rnp-dpi4-9jeazplb1ie"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "q2a9o63o-4x2m-iqdl-bgcf-1krmybs8a06",
      "phtrvvuf-i1z4-rpal-95t6-k0wbkdi1w3"
    ]
  },
  {
    "id": "l0sl3nuu-5qn6-vkeh-3xzs-54pm60ao2pe",
    "createdAt": "2025-07-22T14:42:32.090Z",
    "updatedAt": "2025-07-22T14:42:32.090Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "1y2ckmej-x7zr-yedk-7b9s-amt4o6f62t",
      "857vebk2-dgcg-gem5-2i58-eyow15sh4wn",
      "l3jdcis6-l8br-70rr-oyzu-2g4eq2w9jn",
      "pqp93csx-q9mk-2rnp-dpi4-9jeazplb1ie"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "q2a9o63o-4x2m-iqdl-bgcf-1krmybs8a06",
      "phtrvvuf-i1z4-rpal-95t6-k0wbkdi1w3"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-22T14:42:32.090Z",
    "token": "token_1"
  }
];

