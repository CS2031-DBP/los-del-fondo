const path = require("path");
const { ObjectId } = require("mongoose").Types;
const multer = require("multer");
const { File, Project } = require("../../DB/mongodb");
const fs = require("fs");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|tiff/;
const { logger } = require("../../utils/logger");

const fileFilter = (req, file, cb) => {
  if (!file) return cb(new Error("No file uploaded"));

  const isValid =
    allowedTypes.test(file.mimetype) &&
    allowedTypes.test(path.extname(file.originalname).toLowerCase());
  if (isValid) return cb(null, true);

  const error = new Error("Only image files (jpeg, jpg, png) are allowed");
  error.code = "INVALID_FILE_TYPE";
  return cb(error);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { username } = req.user;

    if (!username) {
      const error = new Error("Username is required");
      error.code = "USERNAME_REQUIRED";
      return cb(error);
    }
    const userDir = path.join(__dirname, "../../../uploads", username);
    try {
      fs.mkdirSync(userDir, { recursive: true });
      console.log(`creating user directory: ${userDir}`);
    } catch (err) {
      const error = new Error(`Error creating user directory: ${err.message}`);
      error.code = "DIRECTORY_CREATION_FAILED";
      return cb(error);
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

exports.upload = multer({ storage, fileFilter });

exports.addFile = async (req, res) => {
  try {
    logger.info({ function: "files/addFile", step: "Start" });

    if (!req.file) {
      return res.status(400).json({ message: "Please upload an image" });
    }
    const { userId, projectId, surname } = req.body;
    let imagePath = req.file.path;

    const projectObjectId = new ObjectId(projectId);
    const project = await Project.findById(projectObjectId);
    if (!project) {
      logger.error({
        message: "Error when searching project",
        projectId: projectId,
      });
      return res.status(404).json({ message: "Project not found" });
    }

    //const imageBuffer = fs.readFileSync(imagePath);
    //const base64Image = imageBuffer.toString("base64");

    const pythonScriptPath = path.join(__dirname, "../../../function.py");
    const pythonCommand = `"C:\\Users\\sora2\\AppData\\Local\\Programs\\Python\\Python312\\python.exe" ${pythonScriptPath} ${imagePath}`;

    try {
      const { stdout, stderr } = await execPromise(pythonCommand);
      if (stderr) {
        const message = "Error processing image with AI service.";
        logger.error({
          message: message,
          error: stderr,
        });
        console.error("Error processing image with AI service: ", stderr);
        return res.status(500).json({
          message: message,
          error: stderr,
        });
      }
      let result;
      try {
        result = JSON.parse(stdout);
      } catch (parseError) {
        const message = "Error parsing AI processing result";
        logger.error({
          message: message,
          error: parseError.message,
        });
        console.error("Error parsing Python response:", parseError);
        return res.status(500).json({
          message: message,
          error: parseError.message,
        });
      }

      const { matches, annotated_image_coded } = result;
      const doorNumber = matches.doors || 0;
      const windowNumber = matches.windows || 0;
      const textNumber = matches.texts || 0;
      const aiContent = JSON.stringify(matches);

      const imageUrl = `/uploads/${req.user.username}/${req.file.filename}`;

      const newFile = new File({
        userId,
        projectId: projectObjectId,
        name: req.file.filename,
        surname,
        doorNumber,
        windowNumber,
        textNumber,
        image: imageUrl, //: annotated_image_coded,
        aiContent,
      });

      await newFile.save();
      await Project.findByIdAndUpdate(
        projectObjectId,
        { $push: { files: newFile._id } },
        { new: true },
      );

      const updateProject = await Project.findById(projectObjectId).populate(
        "files",
      );

      logger.info({ function: "files/addFile", step: "End" });

      return res.status(201).json({
        message: "File added successfully",
        file: newFile,
        project: updateProject,
      });
    } catch (error) {
      const message = "Error processing image with AI service";
      logger.error({
        message: message,
        error: error.message,
      });

      console.error(`Error executing Python script: ${error}`);
      return res.status(500).json({
        message: message,
        error: error.message,
      });
    }
  } catch (error) {
    const message = "Error adding file";
    logger.error({
      message: message,
      error: error,
    });
    console.log("Error adding file:", error);
    res.status(500).json({ message: message, error });
  }
};

exports.getFileById = async (req, res) => {
  try {
    logger.info({ function: "files/getFileById", step: "Start" });

    const { id } = req.params;
    console.log(id);
    const file = await File.findById(id);
    if (!file) {
      const message = "File not found";
      logger.error({
        message: message,
      });
      return res.status(404).json({ message: message });
    }
    console.log(file);
    logger.info({ function: "files/getFileById", step: "End" });
    res.status(200).json({ file });
  } catch (err) {
    const message = "Error getting file";
    logger.error({
      message: message,
    });
    res.status(500).json({ message: message, err });
  }
};

exports.updateFile = async (req, res) => {
  try {
    logger.info({ function: "files/UpdateFIle", step: "Start" });
    const { id } = req.params;
    const { surname } = req.body;
    const updateData = {};
    logger.info({ id: id, surname: surname });

    if (surname) {
      updateData.surname = surname;
    }
    if (req.file) {
      const imagePath = req.file.path;
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString("base64");
      const pythonScriptPath = path.join(__dirname, "../../../function.py");
      const pythonCommand = `"C:\\Users\\sora2\\AppData\\Local\\Programs\\Python\\Python312\\python.exe" ${pythonScriptPath} ${base64Image}`;

      try {
        const { stdout, stderr } = await execPromise(pythonCommand);
        if (stderr) {
          const message = "Error processing image with AI service";
          logger.error({
            message: message,
            error: stderr,
          });
          console.error("Error processing image with AI service:", stderr);
          return res.status(500).json({
            message: message,
            error: stderr,
          });
        }

        const result = JSON.parse(stdout);
        const { matches, annotated_image_coded } = result;

        updateData.doorNumber = matches.doors || 0;
        updateData.windowNumber = matches.windows || 0;
        updateData.textNumber = matches.texts || 0;
        updateData.image = annotated_image_coded;
        updateData.aiContent = JSON.stringify(matches);
      } catch (error) {
        const message = "Error processing image with AI service";
        logger.error({
          message: message,
          error: error.message,
        });
        console.error("Error executing Python script:", error);
        return res.status(500).json({
          message: message,
          error: error.message,
        });
      }
    }

    const updatedFile = await File.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!updatedFile) {
      const message = "File not found";
      logger.error({
        message: message,
      });

      return res.status(404).json({ message: message });
    }

    logger.info({ function: "files/updateFile", step: "End" });
    res
      .status(200)
      .json({ message: "File updated successfully", file: updatedFile });
  } catch (error) {
    const message = "Error updating file";
    logger.error({
      message: message,
      error: error,
    });
    res.status(500).json({ message: message, error });
  }
};

exports.updateSurname = async (req, res) => {
  try {
    logger.info({ function: "files/updateSurname", step: "Start" });
    const { id } = req.params;
    const { surname } = req.body;
    logger.info({ id: id, surname: surname });

    if (!surname) {
      const message = "Surname is required";
      logger.error({
        message: message,
      });
      return res.status(400).json({ message: message });
    }

    const updateFile = await File.findByIdAndUpdate(
      id,
      { surname },
      { new: true },
    );
    if (!updateFile) {
      const message = "File not found";
      logger.error({
        message: message,
      });
      return res.status(404).json({ message: message });
    }

    logger.info({ function: "files/updateSurname", step: "End" });
    res
      .status(200)
      .json({ message: "Surname updated successfully", file: updateFile });
  } catch (err) {
    const message = "Error updating surname";
    logger.error({
      message: message,
      error: err,
    });
    res.status(500).json({ message: message, error });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    logger.info({ function: "files/updateStatus", step: "Start" });

    const { id } = req.params;
    const { status } = req.body;
    logger.info({ id: id, status: status });

    const validStatuses = ["deleted", "bookmarked", "archived", "default"];
    if (!status || !validStatuses.includes(status)) {
      const message = "Invalid or missing status";
      logger.error({
        message: message,
      });
      return res.status(400).json({ message: message });
    }

    const updatedFile = await File.findByIdAndUpdate(
      id,
      { status, latestStatusUpdate: Date.now() },
      { new: true },
    );

    if (!updatedFile) {
      const message = "File not found";
      logger.error({
        message: message,
      });
      return res.status(404).json({ message: message });
    }

    logger.info({ function: "files/updateStatus", step: "End" });
    res
      .status(200)
      .json({ message: "Status updated successfully", file: updatedFile });
  } catch (error) {
    res.status(500).json({ message: "Error updating status", error });
  }
};

exports.deleteFile = async (req, res) => {
  try {
    logger.info({ function: "files/deleteFile", step: "Start" });

    const { id } = req.params;
    const deletedFile = await File.findByIdAndDelete(id);
    if (!deletedFile) return res.status(404).json({ message: "File not found" });
    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting file", error });
  }
};
