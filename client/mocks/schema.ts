// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 32,
    "userId": 3,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 51,
    "scope": "scope_1",
    "tokenType": "tokenType_1"
  }
];

// EVALS MOCK DATA
export const evals = [
  {
    "id": "11mz52fk-vh3h-dna1-kl9p-erjlam3g5sd",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "Math Skills Evaluation",
    "description": "Comprehensive evaluation of mathematical problem-solving abilities",
    "baseAgentId": "baseAgentId_1",
    "scenarioIds": [
      "j4266qmt-l1hs-yk82-xqve-vlw1okha89",
      "q3wx7mcr-814t-gzd9-egi5-ankh520fj9i"
    ],
    "agentIds": [
      "id1j54lm-shve-jwns-xy2x-g6drwbgtyu4",
      "ny8oczcj-zqsj-16t7-js00-ar1z4j46z14"
    ],
    "rubricIds": [
      "gk22ciuf-dki0-hh37-7fr2-qff3wnsodnk",
      "8vh78nkl-hs6j-uzed-lbhs-c49y52kj4db"
    ],
    "maxTurns": "maxTurns_1",
    "startOnCreation": "startOnCreation_1"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "33bmb6oh-gtws-ov8y-4npx-lgwiky5c3ms",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "r0kcpyxe-wuw1-ualg-agaf-8kp7k8skk9p",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "completedAt": "2025-06-19T01:27:00.767Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true,
    "traceId": "traceId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 83,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-06-19T01:27:00.767Z"
  }
];

// EVALCHATGRADES MOCK DATA
export const evalChatGrades = [
  {
    "id": "3vpowz1h-kk5b-sm3t-u4o5-0wp0eu7fdmur",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "passed": false,
    "score": 58,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "evalChatId": "evalChatId_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "2f7jzqxb-x58c-i287-uikt-lvujrtqpo7",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "n5n69401-2hkq-anm0-6ar8-n2c3vmluxbk",
      "xxat3x5r-vfl7-ek6r-ua9u-0r97ze1tsop",
      "eywm1qiz-sd2h-znde-94gp-k3vq5oziabm",
      "x4syymh3-d8d6-0ecr-mkez-abr6e01grt"
    ]
  },
  {
    "id": "hbtbm6f3-71ot-1dzl-f1j4-hhylgfe40u",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "n5n69401-2hkq-anm0-6ar8-n2c3vmluxbk",
      "xxat3x5r-vfl7-ek6r-ua9u-0r97ze1tsop",
      "eywm1qiz-sd2h-znde-94gp-k3vq5oziabm",
      "x4syymh3-d8d6-0ecr-mkez-abr6e01grt"
    ]
  }
];

// EVALCHATFEEDBACKS MOCK DATA
export const evalChatFeedbacks = [
  {
    "id": "vic9o3jp-p2ke-zbcp-raon-e3es63a0hrl",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "standardId": "standardId_1",
    "evalChatGradeId": "evalChatGradeId_1",
    "total": 46,
    "feedback": "feedback_1"
  }
];

// EVALCHATS MOCK DATA
export const evalChats = [
  {
    "id": "qojkjhfi-zn1z-b7pb-sv0g-9i45mpf5s1w",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "completedAt": "2025-06-19T01:27:00.767Z",
    "title": "Eval_chats 1",
    "scenarioId": "scenarioId_1",
    "evalRunId": "evalRunId_1",
    "completed": true
  }
];

// EVALRUNS MOCK DATA
export const evalRuns = [
  {
    "id": "3rwbj4vo-ljvu-nyco-821t-uf71xrezwf",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "evalId": "evalId_1",
    "agentId": "agentId_1",
    "rubricId": "rubricId_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "id1j54lm-shve-jwns-xy2x-g6drwbgtyu4",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.14,
    "defaultAgent": "defaultAgent_1"
  },
  {
    "id": "ny8oczcj-zqsj-16t7-js00-ar1z4j46z14",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.38,
    "defaultAgent": "defaultAgent_2"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "6syooydm-2oxk-09x9-h08x-mbhkv22inz8",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "documentType": "documentType_1",
    "time": "2025-06-19T01:27:00.767Z",
    "scheduleId": "scheduleId_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "k9z22fp8-en80-zahj-ji5f-e6zm569dyfm",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "a2scfggz-5a3r-z4pz-oser-jmmquskqm8q",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "3aiivcve-52he-zq7n-8a4h-qji76lwv48k",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2"
  }
];

// EVALMESSAGES MOCK DATA
export const evalMessages = [
  {
    "id": "ckqiyao9-qkwk-vr2v-wqgw-aoyydki2tb",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "mx01dfv4-mo4x-cmeq-qctm-eu79d6yken9",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "n5n69401-2hkq-anm0-6ar8-n2c3vmluxbk",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "userId": 83,
    "lastLogin": "2025-06-19T01:27:00.767Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "role": "admin",
    "classIds": [
      "a2scfggz-5a3r-z4pz-oser-jmmquskqm8q",
      "3aiivcve-52he-zq7n-8a4h-qji76lwv48k"
    ]
  },
  {
    "id": "xxat3x5r-vfl7-ek6r-ua9u-0r97ze1tsop",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "lastLogin": "2025-06-19T01:27:00.767Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "role": "instructional",
    "classIds": [
      "a2scfggz-5a3r-z4pz-oser-jmmquskqm8q",
      "3aiivcve-52he-zq7n-8a4h-qji76lwv48k"
    ],
    "userId": 19
  },
  {
    "id": "eywm1qiz-sd2h-znde-94gp-k3vq5oziabm",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "userId": 64,
    "lastLogin": "2025-06-19T01:27:00.767Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "role": "instructor",
    "classIds": [
      "a2scfggz-5a3r-z4pz-oser-jmmquskqm8q",
      "3aiivcve-52he-zq7n-8a4h-qji76lwv48k"
    ]
  },
  {
    "id": "x4syymh3-d8d6-0ecr-mkez-abr6e01grt",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "userId": 70,
    "lastLogin": "2025-06-19T01:27:00.767Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "role": "ta",
    "classIds": [
      "a2scfggz-5a3r-z4pz-oser-jmmquskqm8q",
      "3aiivcve-52he-zq7n-8a4h-qji76lwv48k"
    ]
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 46,
    "userId": 61,
    "expires": "2025-06-19T01:27:00.767Z",
    "sessionToken": "sessionToken_1"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "rx3fm2ml-h7fa-gluw-0kmy-o5ndk7f405j",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "chatId": "chatId_1",
    "query": "query_1",
    "response": "response_1",
    "completed": false
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "4mejjoul-awyo-eslj-8olv-f3gzuwl58dr",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 76,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "ooacu7he-x5t4-np0j-wc1g-x1ab57aewke",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "passed": false,
    "score": 4,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "yjuxbie1-iw3e-nymn-ay4a-bs1ks05e3hk",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "11zblfp4-ixx1-hqeu-or7n-slj13fl70r",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "j4266qmt-l1hs-yk82-xqve-vlw1okha89",
      "q3wx7mcr-814t-gzd9-egi5-ankh520fj9i"
    ],
    "cohortIds": [
      "2f7jzqxb-x58c-i287-uikt-lvujrtqpo7",
      "hbtbm6f3-71ot-1dzl-f1j4-hhylgfe40u"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "dg3zr5kz-sgfh-i62w-oguw-nknrmb249ns",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "title": "Lab Safety Training",
    "active": false,
    "scenarioIds": [
      "j4266qmt-l1hs-yk82-xqve-vlw1okha89",
      "q3wx7mcr-814t-gzd9-egi5-ankh520fj9i"
    ],
    "cohortIds": [
      "2f7jzqxb-x58c-i287-uikt-lvujrtqpo7",
      "hbtbm6f3-71ot-1dzl-f1j4-hhylgfe40u"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// TOPICS MOCK DATA
export const topics = [
  {
    "id": "gkbr3mzd-b7l5-r35m-k887-2xxlbewqg0k",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": true,
    "classId": "classId_1"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 83,
    "name": "Admin User",
    "emailVerified": "2025-06-19T01:27:00.767Z",
    "image": "image_1"
  },
  {
    "id": 19,
    "email": "instructional@example.com",
    "emailVerified": "2025-06-19T01:27:00.767Z",
    "image": "image_2"
  },
  {
    "id": 64,
    "name": "Instructor User"
  },
  {
    "id": 70,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-06-19T01:27:00.767Z",
    "image": "image_4"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "xth7kpef-135t-fxtw-6bjt-j1kup98j5cq",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": false,
    "fileId": "fileId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "mvvx48wt-yn39-n87b-jhq2-wqgmy3v98j8",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 77,
    "standardGroupId": "standardGroupId_1"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "gk22ciuf-dki0-hh37-7fr2-qff3wnsodnk",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 77,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "8vh78nkl-hs6j-uzed-lbhs-c49y52kj4db",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 97,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "j4266qmt-l1hs-yk82-xqve-vlw1okha89",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "crowdedness": 86,
    "defaultScenario": "defaultScenario_1"
  },
  {
    "id": "q3wx7mcr-814t-gzd9-egi5-ankh520fj9i",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "updatedAt": "2025-06-19T01:27:00.767Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "classId": "classId_2",
    "crowdedness": 78,
    "intensity": 77,
    "seniority": "sophomore",
    "defaultScenario": "defaultScenario_2"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "k4sljrff-njsh-d98k-hseu-53q6d238mai",
    "createdAt": "2025-06-19T01:27:00.767Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 100,
    "feedback": "feedback_1"
  }
];

// MIGRATIONS MOCK DATA
export const migrations = [
  {
    "id": 69,
    "hash": "hash_1",
    "mode": "mode_1",
    "createdAt": 100
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-06-19T01:27:00.767Z",
    "token": "token_1"
  }
];

