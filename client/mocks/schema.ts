// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 41,
    "userId": 76,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "mode": "mode_1",
    "expiresAt": 1,
    "idToken": "idToken_1",
    "scope": "scope_1",
    "sessionState": "sessionState_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 89,
    "userId": 82,
    "expires": "2025-08-10T21:25:11.087Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "gyl1615g-8aup-dz5t-rmxi-a6h42onps5p",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "type": "homework",
    "classified": true,
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
    "id": 75,
    "name": "Admin User",
    "email": "admin@example.com",
    "image": "image_1"
  },
  {
    "id": 59,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-08-10T21:25:11.087Z",
    "image": "image_2"
  },
  {
    "id": 39,
    "email": "instructor@example.com",
    "emailVerified": "2025-08-10T21:25:11.087Z",
    "image": "image_3"
  },
  {
    "id": 55,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-08-10T21:25:11.087Z"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "x1g5spjn-wcs7-4fp4-p4ln-bak5vmf7fvr",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "lastLogin": "2025-08-10T21:25:11.087Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-08-10T21:25:11.087Z",
    "userId": 75
  },
  {
    "id": "1oo20234-qjjt-o76w-0gvm-6g4o7npq8qx",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "lastLogin": "2025-08-10T21:25:11.087Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-08-10T21:25:11.087Z",
    "userId": 59
  },
  {
    "id": "tvore117-rlbs-b015-4p4t-zc7qcj8qq0j",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "userId": 39,
    "lastLogin": "2025-08-10T21:25:11.087Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-08-10T21:25:11.087Z"
  },
  {
    "id": "hvj3abd4-dxko-k235-5es4-a9huoedicqk",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "userId": 55,
    "lastLogin": "2025-08-10T21:25:11.087Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-08-10T21:25:11.087Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "wt5r98kg-q55x-pwbc-715r-reoyc18q4m",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "i3sqaxc0-31vg-ccbq-oser-qjvypwwjsm",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
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
    "id": "jfopgfo0-34pw-zd34-mmyi-iwgotqxlrmn",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 55,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "ie6bmlu1-zdf1-vgws-f47l-7ag8qkljdlo",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 38,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "9xtmo9uy-a3hu-iqel-kpet-sgkjez6u0o9",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 100,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 81,
    "level": "level_1",
    "context": {},
    "createdAt": "2025-08-10T21:25:11.087Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "en05st85-yyj6-1i03-ov9d-enon3fzt9rs",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 29,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 38,
    "createdAt": "2025-08-10T21:25:11.087Z",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "6803z26b-ouge-uzb6-gj55-sig0nsrforp",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "w7w6izfp-abe7-mhis-sk9n-gqaft6ytd7t",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "completedAt": "2025-08-10T21:25:11.087Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "yloe37we-eqg9-zdjf-2l8u-ggah3a6tr5e",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": false
  }
];

// PERSONAS MOCK DATA
export const personas = [
  {
    "id": "k4ep3ezc-bk3t-e3dd-23fj-z7tauoi8z97",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": "temperature_1",
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
    "id": "qa1xihza-8fqj-ej0d-4uuz-luckehubbm",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": "temperature_1",
    "reasoning": "minimal"
  },
  {
    "id": "hvyb7ut0-jn7q-wuks-9q1d-z90ctcau0h9",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": "temperature_2"
  }
];

// MODELRUNS MOCK DATA
export const modelRuns = [
  {
    "id": "undwzon1-m8mz-zeeo-h18k-voqepxxni9l",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "modelId": "modelId_1",
    "inputTokens": "inputTokens_1",
    "outputTokens": "outputTokens_1",
    "profileId": "profileId_1"
  }
];

// DEBUGINFO MOCK DATA
export const debugInfo = [
  {
    "id": "pvs32271-ugg9-gq64-subn-wkt0zvb6h5",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "modelRunId": "modelRunId_1",
    "content": "content_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "pn5s4rwp-1hl0-6oew-g3ha-i6phksco4wo",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
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
    "active": true,
    "checkpoints": [
      "checkpoints_1"
    ]
  },
  {
    "id": "dg305cf4-3jx1-ljj6-itpf-i3x796up17d",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "parameterItemIds": [
      "parameterItemIds_2"
    ],
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": false,
    "parentId": "parentId_2",
    "active": false,
    "checkpoints": [
      "checkpoints_2"
    ]
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "1mp6bcfe-q362-c0tj-r8wf-waym802en2",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": false,
    "active": true,
    "defaultParameter": "defaultParameter_1"
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "ifurrxok-5ln2-47me-fm3x-1p94c03p6at",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
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
    "id": "7bnagxcn-s5l8-o8px-05a0-gro365fshv",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1",
    "infiniteMode": "infiniteMode_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "oktfanvz-n3b8-ggq7-yrfv-ntpzznzzeqn",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "title": "Math Practice Simulation",
    "active": true,
    "scenarioIds": [
      "pn5s4rwp-1hl0-6oew-g3ha-i6phksco4wo",
      "dg305cf4-3jx1-ljj6-itpf-i3x796up17d"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "f8i36bzv-gtuh-kdly-pgj1-1khp7mt5z6d",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "title": "Lab Safety Training",
    "active": false,
    "scenarioIds": [
      "pn5s4rwp-1hl0-6oew-g3ha-i6phksco4wo",
      "dg305cf4-3jx1-ljj6-itpf-i3x796up17d"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "atmjvjz0-y8zu-de6b-lhu3-0n00ru7ee3c",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "completedAt": "2025-08-10T21:25:11.087Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "yuwp3cdr-xycm-1j8v-4bgm-wyliok76s9",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "de7kbvkt-4z26-o7qm-erz4-aq8ooqlzqu",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "passed": false,
    "score": 9,
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
    "id": "uwfms4s7-wgqp-uv9w-cjbl-rnsyg7jnrxm",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 43,
    "feedback": "feedback_1"
  }
];

// SIMULATIONCHATCROWDSOURCEDFEEDBACKS MOCK DATA
export const simulationChatCrowdsourcedFeedbacks = [
  {
    "id": "4wmd8i0f-lpug-zzpo-h6a1-mn2y99e80r",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "simulationChatFeedbackId": "simulationChatFeedbackId_1",
    "total": 71
  }
];

// SIMULATIONCROWDSOURCEDMESSAGES MOCK DATA
export const simulationCrowdsourcedMessages = [
  {
    "id": "jn85ofgs-bzb5-7osn-xp23-4nv0k83w2kh",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "simulationMessageId": "simulationMessageId_1",
    "profileId": "profileId_1",
    "response": false
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "b2vd4vm3-1h19-euv1-pulz-va3l1om81d9",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "x1g5spjn-wcs7-4fp4-p4ln-bak5vmf7fvr",
      "1oo20234-qjjt-o76w-0gvm-6g4o7npq8qx",
      "tvore117-rlbs-b015-4p4t-zc7qcj8qq0j",
      "hvj3abd4-dxko-k235-5es4-a9huoedicqk"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "oktfanvz-n3b8-ggq7-yrfv-ntpzznzzeqn",
      "f8i36bzv-gtuh-kdly-pgj1-1khp7mt5z6d"
    ]
  },
  {
    "id": "8q03uyhf-z5q1-8u3w-6tnb-2nhq07woluh",
    "createdAt": "2025-08-10T21:25:11.087Z",
    "updatedAt": "2025-08-10T21:25:11.087Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "x1g5spjn-wcs7-4fp4-p4ln-bak5vmf7fvr",
      "1oo20234-qjjt-o76w-0gvm-6g4o7npq8qx",
      "tvore117-rlbs-b015-4p4t-zc7qcj8qq0j",
      "hvj3abd4-dxko-k235-5es4-a9huoedicqk"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "oktfanvz-n3b8-ggq7-yrfv-ntpzznzzeqn",
      "f8i36bzv-gtuh-kdly-pgj1-1khp7mt5z6d"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-08-10T21:25:11.087Z",
    "token": "token_1"
  }
];

