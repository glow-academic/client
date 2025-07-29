// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 2,
    "userId": 73,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "idToken": "idToken_1",
    "scope": "scope_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 70,
    "userId": 28,
    "expires": "2025-07-29T14:36:26.938Z",
    "sessionToken": "sessionToken_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "3ib90sgv-2a9s-sxl9-oi3p-o03dtsz3hip",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
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
    "id": 44,
    "name": "Admin User",
    "email": "admin@example.com",
    "image": "image_1"
  },
  {
    "id": 90,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-29T14:36:26.938Z"
  },
  {
    "id": 1,
    "email": "instructor@example.com",
    "emailVerified": "2025-07-29T14:36:26.938Z"
  },
  {
    "id": 25,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-07-29T14:36:26.938Z"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "cmlcnwvr-eueu-gb3d-0nl4-e59itl57gh",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "userId": 44,
    "lastLogin": "2025-07-29T14:36:26.938Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "viewedChat": "viewedChat_1",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "lastActive": "2025-07-29T14:36:26.938Z"
  },
  {
    "id": "9qfp6ua2-zw6m-ydl1-0aoa-6otgdpwcka8",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "userId": 90,
    "lastLogin": "2025-07-29T14:36:26.938Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "viewedChat": "viewedChat_2",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false,
    "lastActive": "2025-07-29T14:36:26.938Z"
  },
  {
    "id": "jw5seiz8-89d1-miuq-h1if-14mqyf809yh",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "lastLogin": "2025-07-29T14:36:26.938Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "viewedChat": "viewedChat_3",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false,
    "lastActive": "2025-07-29T14:36:26.938Z",
    "userId": 1
  },
  {
    "id": "h793b4ev-ccp0-l30h-7xjn-cmgfvsj6k9",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "userId": 25,
    "lastLogin": "2025-07-29T14:36:26.938Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "viewedChat": "viewedChat_4",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false,
    "lastActive": "2025-07-29T14:36:26.938Z"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "x6zdn5fh-wn80-fx5f-dpyp-uv2pg6gff9g",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "ye2iwbck-n7xn-6jih-ovyx-01c8vrvayek3",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "uv6ujj3l-trbz-8knb-kpoq-nqn8nyhy2v",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 57,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1",
    "active": true
  },
  {
    "id": "c2w7l560-mrxa-o8jv-arpj-r9l9uffpmt",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 29,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2",
    "active": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "3jks73qz-i0op-71ta-2xo6-on5hhejfla",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 50,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 57,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-07-29T14:36:26.938Z"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "pa37ikox-dkji-90nu-vlk7-coebbphx3am",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 37,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 31,
    "createdAt": "2025-07-29T14:36:26.938Z",
    "profileId": "profileId_1",
    "type": "feature",
    "message": "message_1"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "vp8j4e51-2wqr-c7z7-3zuw-qu4feesan3f",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "p9x372b3-c1g3-6pez-l7qn-w0b088uj4zs",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "completedAt": "2025-07-29T14:36:26.938Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "gqq4wa4q-lhym-zyf1-q2q4-nug97k4hjf",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
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
    "id": "5ijhllx0-fxbx-9kig-0wqm-zo6c30urmra",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "name": "Personas 1",
    "description": "Description for personas 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.6,
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
    "id": "ers7fbmg-wdje-ciku-vgqw-b0ykszjbhyl",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.65,
    "modelId": "modelId_1",
    "reasoning": "low"
  },
  {
    "id": "ootd0t2k-3ny5-56ud-eplr-0i6i1cl5k906",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.69,
    "modelId": "modelId_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "3bfoogcd-o9ix-m6of-gfqn-bnvgad9b6vn",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// PARAMETERS MOCK DATA
export const parameters = [
  {
    "id": "58tddzlk-d41t-pbtt-wz2n-cktl3w2f9r4",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "name": "Parameters 1",
    "description": "Description for parameters 1",
    "numerical": false,
    "active": true
  }
];

// PARAMETERITEMS MOCK DATA
export const parameterItems = [
  {
    "id": "km4n5qwz-yq5c-jmvl-324g-tr42qjt7cla",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
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
    "id": "ciaw56mg-cdvq-t41j-ge84-z212zwormvh",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "parameterItemIds": [
      "parameterItemIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": false,
    "parentId": "parentId_1",
    "active": true
  },
  {
    "id": "pj3oiqhm-t9ft-e3d4-3sq4-1djepejl8yg",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
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
    "id": "fw65qevm-bjs8-v0k4-lwk9-rky7iy15xkb",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "completedAt": "2025-07-29T14:36:26.938Z",
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
    "id": "xbltuqv7-t082-dlm6-oebe-rgllh4su4",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "ciaw56mg-cdvq-t41j-ge84-z212zwormvh",
      "pj3oiqhm-t9ft-e3d4-3sq4-1djepejl8yg"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1",
    "practiceSimulation": "practiceSimulation_1"
  },
  {
    "id": "jhz8wpau-dua8-daad-lqr1-ndpk10pyca",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "title": "Lab Safety Training",
    "active": false,
    "scenarioIds": [
      "ciaw56mg-cdvq-t41j-ge84-z212zwormvh",
      "pj3oiqhm-t9ft-e3d4-3sq4-1djepejl8yg"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2",
    "practiceSimulation": "practiceSimulation_2"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "gl400nyb-2j76-dtpp-124b-eernp8rv9tn",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "5qac786j-o0gl-wjoq-g9gp-8fq6ax5b6y8",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "passed": true,
    "score": 97,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "smos5sot-lkj0-ijw3-rtpl-qytdv504hml",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 47
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "zkcwtazf-qhjk-z92k-846h-3qmbqxjijvi",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "cmlcnwvr-eueu-gb3d-0nl4-e59itl57gh",
      "9qfp6ua2-zw6m-ydl1-0aoa-6otgdpwcka8",
      "jw5seiz8-89d1-miuq-h1if-14mqyf809yh",
      "h793b4ev-ccp0-l30h-7xjn-cmgfvsj6k9"
    ],
    "defaultCohort": "defaultCohort_1",
    "simulationIds": [
      "xbltuqv7-t082-dlm6-oebe-rgllh4su4",
      "jhz8wpau-dua8-daad-lqr1-ndpk10pyca"
    ]
  },
  {
    "id": "rfu0ojh5-itru-fl2k-5bha-epe7nqbz28m",
    "createdAt": "2025-07-29T14:36:26.938Z",
    "updatedAt": "2025-07-29T14:36:26.938Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "cmlcnwvr-eueu-gb3d-0nl4-e59itl57gh",
      "9qfp6ua2-zw6m-ydl1-0aoa-6otgdpwcka8",
      "jw5seiz8-89d1-miuq-h1if-14mqyf809yh",
      "h793b4ev-ccp0-l30h-7xjn-cmgfvsj6k9"
    ],
    "defaultCohort": "defaultCohort_2",
    "simulationIds": [
      "xbltuqv7-t082-dlm6-oebe-rgllh4su4",
      "jhz8wpau-dua8-daad-lqr1-ndpk10pyca"
    ]
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-29T14:36:26.938Z",
    "token": "token_1"
  }
];

