// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 10,
    "userId": 93,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "mode": "mode_1",
    "expiresAt": 88,
    "scope": "scope_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 1,
    "userId": 53,
    "expires": "2025-08-08T15:14:40.655Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "sbih41yg-k8fn-2jly-rqkw-f3kdw5j76ma",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
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
    "id": 54,
    "name": "Admin User",
    "email": "admin@example.com",
    "emailVerified": "2025-08-08T15:14:40.655Z",
    "image": "image_1"
  },
  {
    "id": 64,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-08-08T15:14:40.655Z",
    "image": "image_2"
  },
  {
    "id": 49,
    "email": "instructor@example.com",
    "emailVerified": "2025-08-08T15:14:40.655Z",
    "image": "image_3"
  },
  {
    "id": 69,
    "name": "TA User",
    "email": "ta@example.com",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "0luuhnzx-ltin-rqrj-gbp0-slj0l3eux5e",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "lastLogin": "2025-08-08T15:14:40.655Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-08-08T15:14:40.655Z",
    "userId": 54
  },
  {
    "id": "9m9o1aqb-ulau-o2j4-ep2p-76ktcxhzxbc",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "lastLogin": "2025-08-08T15:14:40.655Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-08-08T15:14:40.655Z",
    "userId": 64
  },
  {
    "id": "pc5tza31-k2ar-oyfl-cgxk-8bl3of8wglx",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "userId": 49,
    "lastLogin": "2025-08-08T15:14:40.655Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-08-08T15:14:40.655Z"
  },
  {
    "id": "w5prrzsj-da0o-idvb-5cxy-q61w8yuklhn",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "lastLogin": "2025-08-08T15:14:40.655Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-08-08T15:14:40.655Z",
    "userId": 69
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "1a8h4jme-8b7f-ro5a-ycat-tjqjvezuece",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "tr96wc7a-z4ff-lyz9-ozj1-bcgnyjscf09",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "a7e4k69o-dw7u-1ju5-w0o6-vneqiiu6een",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 26,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "a6rxb4bj-jc59-2c19-s2bk-8vj3ujmqjz5",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 98,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "h2zxwox8-65em-60eb-g6g5-cfv7gll13i5",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 61,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 7,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-08-08T15:14:40.655Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "qr6cd6h6-d9ql-8l0j-gmpy-pqbkff6h8mj",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 78,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 22,
    "createdAt": "2025-08-08T15:14:40.655Z",
    "profileId": "profileId_1",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "lnq8kkdp-l24j-6s66-5cf5-u97nhf0jc7",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "67ysadip-ox5i-c7bp-tqt6-x0sks3ym62j",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "completedAt": "2025-08-08T15:14:40.655Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "uit8rvd7-qozo-g9uq-6ooz-hs7zgghafos",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
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
    "id": "9vqohgkz-8cfw-iih3-xgfr-1qz3eoxrxoj",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": "temperature_1",
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "icon": "icon_1",
    "modelId": "modelId_1",
    "reasoning": "low",
    "active": true
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "ywdbnerg-l9ex-1xfi-m64a-myzzot2r2o",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": "temperature_1",
    "reasoning": "low"
  },
  {
    "id": "dwf5mmgq-dmc3-26y8-b5jb-4zm1f73yrwh",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": "temperature_2",
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "danq3aqz-ebe4-oe9m-clvl-288xwb2mhzg",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "simulationId": "simulationId_1"
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "10f801me-24rn-0z4r-u657-x5su24zd7c8",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": true,
    "active": true
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "6i4oavg6-ynjc-9djq-ru04-vst6vqr90sk",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
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
    "id": "2xe6hwd4-cpjs-bcbg-xm3o-7q5x3w6un6h",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "personaId": "personaId_1",
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
    "id": "cio9ghhs-zldx-pvwn-jbum-x98sm9vee7q",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
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
    "generated": true,
    "parentId": "parentId_2",
    "active": false
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "ssfi1otv-9vnq-puxt-y32k-4mpn60x9kpe",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "completedAt": "2025-08-08T15:14:40.655Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false,
    "traceId": "traceId_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "n135hkbq-9t2a-ntb4-2wxt-0r4peh1wxj9g",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "title": "Math Practice Simulation",
    "active": true,
    "scenarioIds": [
      "2xe6hwd4-cpjs-bcbg-xm3o-7q5x3w6un6h",
      "cio9ghhs-zldx-pvwn-jbum-x98sm9vee7q"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "0d7h9za0-ir6i-2o59-f4th-722mfzw3nnn",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "2xe6hwd4-cpjs-bcbg-xm3o-7q5x3w6un6h",
      "cio9ghhs-zldx-pvwn-jbum-x98sm9vee7q"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "uijzor5h-vlha-xqip-yi9r-tbko4c947mj",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "f02dmm7y-ujzy-4r60-ykca-ccpojwyc0v9",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "passed": false,
    "score": 48,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "3q10rdgj-r2p3-eibx-hkhg-z00mdp3pdrp",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 31
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "196vrup2-leq2-iy0w-uvaw-stvr0ifdsa",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "0luuhnzx-ltin-rqrj-gbp0-slj0l3eux5e",
      "9m9o1aqb-ulau-o2j4-ep2p-76ktcxhzxbc",
      "pc5tza31-k2ar-oyfl-cgxk-8bl3of8wglx",
      "w5prrzsj-da0o-idvb-5cxy-q61w8yuklhn"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "n135hkbq-9t2a-ntb4-2wxt-0r4peh1wxj9g",
      "0d7h9za0-ir6i-2o59-f4th-722mfzw3nnn"
    ]
  },
  {
    "id": "7y4ewa0q-0wcs-wjhs-gs43-x6kf89n63b",
    "createdAt": "2025-08-08T15:14:40.655Z",
    "updatedAt": "2025-08-08T15:14:40.655Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "0luuhnzx-ltin-rqrj-gbp0-slj0l3eux5e",
      "9m9o1aqb-ulau-o2j4-ep2p-76ktcxhzxbc",
      "pc5tza31-k2ar-oyfl-cgxk-8bl3of8wglx",
      "w5prrzsj-da0o-idvb-5cxy-q61w8yuklhn"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "n135hkbq-9t2a-ntb4-2wxt-0r4peh1wxj9g",
      "0d7h9za0-ir6i-2o59-f4th-722mfzw3nnn"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-08-08T15:14:40.655Z",
    "token": "token_1"
  }
];

