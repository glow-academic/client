// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 74,
    "userId": 68,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "expiresAt": 6,
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 67,
    "userId": 26,
    "expires": "2025-07-27T00:05:38.529Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "qi924ht7-3ba6-hsb4-2j56-myz7dn2zloa",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
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
    "id": 57,
    "name": "Admin User",
    "email": "admin@example.com",
    "emailVerified": "2025-07-27T00:05:38.529Z"
  },
  {
    "id": 39,
    "email": "instructional@example.com",
    "emailVerified": "2025-07-27T00:05:38.529Z",
    "image": "image_2"
  },
  {
    "id": 43,
    "email": "instructor@example.com",
    "emailVerified": "2025-07-27T00:05:38.529Z"
  },
  {
    "id": 11,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-07-27T00:05:38.529Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "rsdjam4c-0jhl-dk6i-jlod-sa9eujhtsms",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "userId": 57,
    "lastLogin": "2025-07-27T00:05:38.529Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-27T00:05:38.529Z"
  },
  {
    "id": "qbmlyuow-hqbe-zda0-bbse-hh92yphnrop",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "userId": 39,
    "lastLogin": "2025-07-27T00:05:38.529Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-27T00:05:38.529Z"
  },
  {
    "id": "5o7rwquh-j11b-s2gi-cy3r-9knt6c63yp",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "userId": 43,
    "lastLogin": "2025-07-27T00:05:38.529Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-27T00:05:38.529Z"
  },
  {
    "id": "0tbio2hn-kgwj-d9vb-vr0w-pvvdy6pvzzj",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "userId": 11,
    "lastLogin": "2025-07-27T00:05:38.529Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-27T00:05:38.529Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "f7bpo2r4-2xet-46de-8ifm-3kbn0n7mvd3",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1",
    "baseUrl": "baseUrl_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "frnfibdh-emqi-cflq-7lc0-brj851xzrc4",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "no4py10j-tx9l-e6ze-rkx2-3dr8bhmloxw",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 95,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "6vb92oky-cnbc-518w-vy7x-pz1go3kxgh",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 31,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "iniaunkn-yobo-p1mk-3v7z-tz1gk7xjctm",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 31,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 2,
    "level": "level_1",
    "context": {},
    "createdAt": "2025-07-27T00:05:38.529Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "ffetllrz-o27n-jumk-ou8u-frpihvnaq3",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 22,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 85,
    "createdAt": "2025-07-27T00:05:38.529Z",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "dbzke0ys-n05u-58kf-wpez-yftjbpwjmh",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "h3ied5ln-pwvy-jasi-59e6-8j0nouziwgt",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "completedAt": "2025-07-27T00:05:38.529Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": true
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "v6n0vzig-5o27-50fs-krd5-5x7tl3mlwo3",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
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
    "id": "72zyfmkd-ewm9-2w4n-14gs-gdu7xi1mo7j",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.86,
    "defaultPersona": "defaultPersona_1",
    "color": "color_1",
    "icon": "icon_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "vty5l1xx-65jr-2rxz-4fec-aq7drzfk78",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.48,
    "modelId": "modelId_1"
  },
  {
    "id": "bg1w94t6-u454-exzj-0snd-6rgucx45bpc",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.14,
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "yy1v3nnq-msuw-dty6-3obt-pf9htrq2toh",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "f7y1g9hj-x4ex-b8xv-uiyo-ihsu8jbc2y",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": false,
    "active": true
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "avg7i3ni-g15j-ajgw-tr2j-sownhv3wef",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
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
    "id": "jwzaqtit-bkyb-u70u-8j6v-uuw39d63wva",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "personaId": "personaId_1",
    "parameterItemIds": [
      "parameterItemIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": true,
    "parentId": "parentId_1",
    "active": true
  },
  {
    "id": "90o63uhm-vhlo-w16o-d4m2-8woc1j4tsbc",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
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
    "parentId": "parentId_2",
    "active": false
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "0ijetbvt-n04d-tnou-r1hw-122tvkqoar3k",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "completedAt": "2025-07-27T00:05:38.529Z",
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
    "id": "9qp1nsvz-t4jj-csfa-mta7-xj6m6xldk8e",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "jwzaqtit-bkyb-u70u-8j6v-uuw39d63wva",
      "90o63uhm-vhlo-w16o-d4m2-8woc1j4tsbc"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "nuzx2x0e-lycp-g4h0-37ai-b4vx0rcldg",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "jwzaqtit-bkyb-u70u-8j6v-uuw39d63wva",
      "90o63uhm-vhlo-w16o-d4m2-8woc1j4tsbc"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "c5tyht54-inrh-13bw-rqw5-1hjb7mt314",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "2442861n-z3zk-2c40-tylx-jxx2nponsbj",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "passed": false,
    "score": 91,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "5oe73ywu-n79o-gr08-154r-vlfxk1nmkd",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 5,
    "feedback": "feedback_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "z1g1d9m8-8zmz-6gyn-2f37-55snlrse0ts",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "rsdjam4c-0jhl-dk6i-jlod-sa9eujhtsms",
      "qbmlyuow-hqbe-zda0-bbse-hh92yphnrop",
      "5o7rwquh-j11b-s2gi-cy3r-9knt6c63yp",
      "0tbio2hn-kgwj-d9vb-vr0w-pvvdy6pvzzj"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "9qp1nsvz-t4jj-csfa-mta7-xj6m6xldk8e",
      "nuzx2x0e-lycp-g4h0-37ai-b4vx0rcldg"
    ]
  },
  {
    "id": "xxcz0lc9-0sff-vfs5-9q5s-7s66vd3lgwq",
    "createdAt": "2025-07-27T00:05:38.529Z",
    "updatedAt": "2025-07-27T00:05:38.529Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "rsdjam4c-0jhl-dk6i-jlod-sa9eujhtsms",
      "qbmlyuow-hqbe-zda0-bbse-hh92yphnrop",
      "5o7rwquh-j11b-s2gi-cy3r-9knt6c63yp",
      "0tbio2hn-kgwj-d9vb-vr0w-pvvdy6pvzzj"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "9qp1nsvz-t4jj-csfa-mta7-xj6m6xldk8e",
      "nuzx2x0e-lycp-g4h0-37ai-b4vx0rcldg"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-27T00:05:38.529Z",
    "token": "token_1"
  }
];

