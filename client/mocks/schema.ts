// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 18,
    "userId": 67,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "expiresAt": 33,
    "idToken": "idToken_1",
    "scope": "scope_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 1,
    "userId": 86,
    "expires": "2025-08-11T00:44:49.906Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "vzq6cx56-95qw-t034-erbx-rjloj5odjj9",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": false,
    "fileId": "fileId_1",
    "active": true,
    "tags": [
      "tags_1"
    ]
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 15,
    "name": "Admin User",
    "email": "admin@example.com"
  },
  {
    "id": 2,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-08-11T00:44:49.906Z",
    "image": "image_2"
  },
  {
    "id": 13,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "image": "image_3"
  },
  {
    "id": 37,
    "name": "TA User",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "19fgske8-8p3j-cplt-576x-3l7pygan0gk",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "userId": 15,
    "lastLogin": "2025-08-11T00:44:49.906Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-08-11T00:44:49.906Z"
  },
  {
    "id": "xqzk99eo-wam5-wdz2-qeku-sp3d7rq38o",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "userId": 2,
    "lastLogin": "2025-08-11T00:44:49.906Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-08-11T00:44:49.906Z"
  },
  {
    "id": "lonwhrj6-piif-6uh5-bkw5-3egavzs6aw3",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "userId": 13,
    "lastLogin": "2025-08-11T00:44:49.906Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-08-11T00:44:49.906Z"
  },
  {
    "id": "pcr9ff4s-emli-fb1v-9go5-x7aijmihhdd",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "userId": 37,
    "lastLogin": "2025-08-11T00:44:49.906Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-08-11T00:44:49.906Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "fyr7mlc4-ttci-028f-ed8h-l36jia670ee",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "jxod7xcb-wl81-qn3t-0dz0-gver83atdm",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true,
    "inputPpm": "inputPpm_1",
    "outputPpm": "outputPpm_1"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "nj97mejz-uvau-7ehi-7lus-c5a7gf1e2a",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 69,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "ky2h4m2t-z90l-9bcj-ejsi-y6gck22hgmk",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 7,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "v89zmvgy-q2c6-8oor-mah0-vb96fswf1u",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 88,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 27,
    "level": "level_1",
    "createdAt": "2025-08-11T00:44:49.906Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "h2qamtiz-xghn-vzts-x2zk-bm0gw45orhh",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 10,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 40,
    "createdAt": "2025-08-11T00:44:49.906Z",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "xarm9fhg-7y1g-thkr-8lji-r5es574yzj",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "7o5x5h0l-2v8a-94rs-3lft-se1bnidd9va",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "completedAt": "2025-08-11T00:44:49.906Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "4ggopsw8-3grh-he1t-xoi7-d0z62nanur",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "completedAt": "2025-08-11T00:44:49.906Z",
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
    "id": "773x0seg-lmlq-x3pg-r32i-iryq4lmm5f7",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": "temperature_1",
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "icon": "icon_1",
    "modelId": "modelId_1",
    "reasoning": "minimal",
    "active": true
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "4ycrok3a-svcj-41ii-7ska-vfhgiiwjt2",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": "temperature_1",
    "reasoning": "minimal"
  },
  {
    "id": "r6ocm9ba-l7kg-e646-zqh8-iuik1036ztr",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": "temperature_2",
    "modelId": "modelId_2",
    "reasoning": "low"
  }
];

// MODELRUNS MOCK DATA
export const modelRuns = [
  {
    "id": "k7ar8aww-lg5t-7j6x-lfjb-1i4tuypaiii",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "inputTokens": "inputTokens_1",
    "outputTokens": "outputTokens_1",
    "personaId": "personaId_1",
    "agentId": "agentId_1",
    "profileId": "profileId_1"
  }
];

// DEBUGINFO MOCK DATA
export const debugInfo = [
  {
    "id": "ye9gcxyc-vkki-rxud-cqvc-o7piu7xfzf",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "modelRunId": "modelRunId_1",
    "content": "content_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "htyj2r3j-b4hy-g0pm-1a4f-6o5upy8ph7t",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "personaId": "personaId_1",
    "parameterItemIds": [
      "parameterItemIds_1"
    ],
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
    "id": "gdaslk6p-ouyy-xj9e-zq1j-so4zoejvezj",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "personaId": "personaId_2",
    "parameterItemIds": [
      "parameterItemIds_2"
    ],
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "active": false
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "pmftgmal-h66i-2b36-c593-qbe385o7kns",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": true,
    "active": true,
    "defaultParameter": "defaultParameter_1"
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "ff4oi8od-walf-u7jg-twmj-uuomatzijln",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "name": "Parameter_items 1",
    "description": "Description for parameter_items 1",
    "value": "value_1",
    "parameterId": "parameterId_1",
    "defaultItem": "defaultItem_1"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "u7tc05pv-nybi-ipbg-puua-wra55rh5ju",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1",
    "infiniteMode": "infiniteMode_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "u81m27he-23my-tfld-20mj-fvkk7w5adjk",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "htyj2r3j-b4hy-g0pm-1a4f-6o5upy8ph7t",
      "gdaslk6p-ouyy-xj9e-zq1j-so4zoejvezj"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "7uw2ra5a-x7ph-h65a-rz8b-xejo25elb9k",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "htyj2r3j-b4hy-g0pm-1a4f-6o5upy8ph7t",
      "gdaslk6p-ouyy-xj9e-zq1j-so4zoejvezj"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "3qt6xeku-9lhe-4tbj-mxfv-y0m1qloikom",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "completedAt": "2025-08-11T00:44:49.906Z",
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
    "id": "ruhf88q4-6pby-g62h-b9q3-5yknnlgsqqa",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "qtbf37nn-9h5f-piww-c698-bmuwe94fyj",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "passed": false,
    "score": 71,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1",
    "checkpointsReached": [
      "checkpointsReached_1"
    ]
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "85eofw6c-t5m4-zqof-nc1p-s59r1iutd0k",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 76,
    "feedback": "feedback_1"
  }
];

// SIMULATIONCHATCROWDSOURCEDFEEDBACKS MOCK DATA
export const simulationChatCrowdsourcedFeedbacks = [
  {
    "id": "a34dssea-srs0-9h79-qmpt-fyjujsxvuu6",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "profileId": "profileId_1",
    "simulationChatFeedbackId": "simulationChatFeedbackId_1",
    "total": 9,
    "feedback": "feedback_1"
  }
];

// SIMULATIONCROWDSOURCEDMESSAGES MOCK DATA
export const simulationCrowdsourcedMessages = [
  {
    "id": "7of5ux0y-u9u7-fail-ysyh-v8ea0m2z1ia",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "simulationMessageId": "simulationMessageId_1",
    "profileId": "profileId_1",
    "response": false
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "m5lcpt54-pp59-ux6w-0mde-wqpw00s9eii",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "19fgske8-8p3j-cplt-576x-3l7pygan0gk",
      "xqzk99eo-wam5-wdz2-qeku-sp3d7rq38o",
      "lonwhrj6-piif-6uh5-bkw5-3egavzs6aw3",
      "pcr9ff4s-emli-fb1v-9go5-x7aijmihhdd"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "u81m27he-23my-tfld-20mj-fvkk7w5adjk",
      "7uw2ra5a-x7ph-h65a-rz8b-xejo25elb9k"
    ]
  },
  {
    "id": "g8f75q1m-xnin-xvvs-tfu4-0qsjzr7dznic",
    "createdAt": "2025-08-11T00:44:49.906Z",
    "updatedAt": "2025-08-11T00:44:49.906Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "19fgske8-8p3j-cplt-576x-3l7pygan0gk",
      "xqzk99eo-wam5-wdz2-qeku-sp3d7rq38o",
      "lonwhrj6-piif-6uh5-bkw5-3egavzs6aw3",
      "pcr9ff4s-emli-fb1v-9go5-x7aijmihhdd"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "u81m27he-23my-tfld-20mj-fvkk7w5adjk",
      "7uw2ra5a-x7ph-h65a-rz8b-xejo25elb9k"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-08-11T00:44:49.906Z",
    "token": "token_1"
  }
];

