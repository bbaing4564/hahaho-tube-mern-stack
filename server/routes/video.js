const express = require("express");
const router = express.Router();
const {Video} = require("../models/Video");
const { Subscriber } = require("../models/Subscriber");
const {auth} = require("../middleware/auth");

const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");

// STORAGE MULTER CONFIG
let storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if (ext !== ".mp4") {
      return cb(req.status(400).end("only mp4 is allowed"), false);
    }
    cb(null, true);
  },
});

const upload = multer({storage: storage}).single("file");

//=================================
//             Video
//=================================

router.post("/uploadfiles", (req, res) => {
  // 비디오를 서버에 저장
  upload(req, res, (err) => {
    if (err) {
      return res.json({success: false, err});
    }
    return res.json({
      success: true,
      url: res.req.file.path,
      fileName: res.req.file.filename,
    });
  });
});

router.post("/uploadVideo", (req, res) => {
  // 비디오 정보를 db에 저장
  const video = new Video(req.body);

  video.save((err, video) => {
    if (err) return res.status(400).json({success: false, err});
    return res.status(200).json({
      success: true,
    });
  });
});

router.post('/getVideoDetail', (req, res) => {

  Video.findOne({"_id": req.body.videoId})
    .populate('writer')
    .exec((err, videoDetail) => {
      if (err) return res.status(400).send(err);
      return res.status(200).send({success: true, videoDetail})
    })
})

router.get("/getVideos", (req, res) => {
  // 비디오를 db에서 가져와 클라이언트에 보냄
  Video.find()
    .populate('writer')
    .exec((err, videos) => {
      if (err) return res.status(400).send(err);
      res.status(200).json({success: true, videos})
    })
});

router.post("/getSubscriptionVideos", (req, res) => {
  //Need to find all of the Users that I am subscribing to From Subscriber Collection
  Subscriber.find({'userFrom': req.body.userFrom})
    .exec((err, subscribers) => {
      if (err) return res.status(400).send(err);

      let subscribedUser = [];

      subscribers.map((subscriber, i) => {
        subscribedUser.push(subscriber.userTo)
      })

  //Need to Fetch all of the Videos that belong to the Users that I found in previous step.
  Video.find({writer: {$in: subscribedUser}})
    .populate('writer')
    .exec((err, videos) => {
      if (err) return res.status(400).send(err);
      res.status(200).json({success: true, videos})
    })
  })
});

router.post("/thumbnail", (req, res) => {
  // 썸네일 생성 & 비디오 러닝타임 가져오기
  let filePath = "";
  let fileDuration = "";

  // Get informations
  ffmpeg.ffprobe(req.body.url, function (err, metadata) {
    console.dir(metadata);
    console.log(metadata.format.duration);
    fileDuration = metadata.format.duration;
  });

  // Genearte Thumbnails
  ffmpeg(req.body.url)
    .on("filenames", function (filenames) {
      console.log("Will generate " + filenames.join(", "));
      console.log(filenames);

      filePath = "uploads/thumbnails/" + filenames[0];
    })
    .on("end", function () {
      console.log("Screenshots taken");
      return res.json({
        success: true,
        url: filePath,
        fileDuration: fileDuration,
      });
    })
    .on("error", function (err) {
      console.log(err);
      return res.json({success: false, err});
    })
    .screenshots({
      // Will take screenshots at 20%, 40%, 60% and 80% of the video
      count: 3,
      folder: "uploads/thumbnails",
      size: "320x240",
      // '%b' : input basename (filename without extension)
      filename: "thumbnail-%b.png",
    });
});

module.exports = router;
