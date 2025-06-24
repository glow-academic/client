import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    message: "Test socketio route works",
    url: req.url,
    method: req.method,
  });
}
