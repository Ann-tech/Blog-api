const { default: mongoose } = require('mongoose')
const articleModel = require('../models/articleModel')
const userModel = require('../models/userModel')

async function getAllArticles(req, res, next) {
    try {
        const { query } = req;

        const { 
            author, 
            title, 
            tags,
            order = 'asc', 
            order_by = 'timestamp', 
            skip = 0, 
            per_page = 20 
        } = query;
    
        const findQuery = {};
    
        if (author) {
            findQuery.author = author
        } 
    
        if (title) {
            findQuery.title = title
        }

        if (tags) {
            findQuery.tags = { $in: tags }
        }

        findQuery.state = 'published'
    
        const sortQuery = {};
    
        const sortAttributes = order_by.split(',')
    
        for (const attribute of sortAttributes) {
            if (order === 'asc' && order_by) {
                sortQuery[attribute] = 1
            }
        
            if (order === 'desc' && order_by) {
                sortQuery[attribute] = -1
            }
        }
    
    
        const articles = await articleModel
        .find(findQuery)
        .sort(sortQuery)
        .skip(skip)
        .limit(per_page)
        
        return res.status(200).json(articles)
    } catch(err) {
        next(err)
    }
}

async function createArticle(req, res, next) {
    const alphabets = "abcdefghijklmnopqrstuvwxyz0123456789"
    const { title } = req.body
    const lowerCaseTitle = title.toLowerCase()
    let formattedTitle = ""
    
    //Formats title to be stored in db. This will be used to get a single article
    for (let i = 0; i < lowerCaseTitle.length; i++) {
        
        if (alphabets.includes(lowerCaseTitle[i])) formattedTitle += lowerCaseTitle[i]
        
        if (lowerCaseTitle[i] == " " && formattedTitle.slice(-1) != "-") formattedTitle += "-"
    }
    if (formattedTitle.slice(-1) == "-") formattedTitle = formattedTitle.slice(0, -1)

    try {
        const user = await userModel.findById(req.user._id);
        const article = await articleModel.create({
            ...req.body,
            author: `${user.last_name} ${user.first_name}`,
            formattedTitle: formattedTitle,
            authorId: req.user._id
        })
        
        const response = {article: {...article._doc}, status: true, message: "Article creation successful"}
        return res.status(201).json(response)
    } catch(err) {
        next(err)
    }
    
}

async function updateArticle(req, res, next) {
    const id = req.params.id
    const authorId = req.user._id
    const infoToUpdate = req.body

    try {
        const update = await articleModel.findByIdAndUpdate(id, {...infoToUpdate, authorId}, {new: true})
        const response = {article: {...update._doc}, status: true, message: "Update successful"}
        return res.status(200).json(response)
    } catch(err) {
        next(err)
    }   
}

async function filterByDraftsOrPublished(req, res, next) {
    const authorId = req.user._id;
    let state = req.params.state

    if (state == "drafts") state = "draft"

    try {
        const filter = await articleModel.find({authorId, state: state})

        const response = {articles: filter, status: true}
        return res.status(200).json(response)
    } catch(err) {
        next(err)
    }
}


async function updateDraftToPublished(req, res, next) {
    const authorId = req.user._id
    const _id = req.params.id

    try {
        const article = await articleModel.findOne({_id, authorId})
        if (article.state == 'published') return res.status(200).json({article: article, message: "Article has already been published"})

        article.state = 'published'
        article.timestamp = new Date()

        let reading_time = Math.round(article.body.split(" ").length / 200)
        article.reading_time = `${reading_time || 1} min read`
        await article.save()
        
        const response = {article: {...article._doc}, status: true, message: "Update successful - your article is now live"}
        return res.status(200).json(response)
    } catch(err) {
        next(err)
    }
}

async function getArticleByIdOrTitle(req, res, next) {
    const idOrTitle = req.params.idOrTitle;
    try {
        let article = await articleModel.findOne({formattedTitle: idOrTitle})

        //check state of article
        if (article?.state == 'published') {
            article.read_count++
            await article.save()
            return res.status(200).json(article)
        }
        if (article?.state == 'draft') return res.status(404).json({message: "Aritlce hasn't been published", status: false})

        article = await articleModel.findOne({_id: idOrTitle})

        if (article?.state == 'published') {
            article.read_count++
            await article.save()
            return res.status(200).json(article)
        }
        if (article?.state == 'draft') return res.status(404).json({message: "Aritlce hasn't been published", status: false})

        return res.status(404).json({message: "Aritlce doesn't exist", status: false})
    } catch(err) {
        next(err)
    }
}

async function deleteArticle(req, res, next) {
    const id = req.params.id
    const authorId = req.user._id

    try {
        const deleteArticle = await articleModel.deleteOne({_id: id, authorId})
        if (deleteArticle.deletedCount == 0) return res.status(404).json({status: false, message: "Article with such id doesn't exist"})

        const response = {status: true, message: "Article successfully deleted"}
        
        return res.status(200).json(response)
    } catch(err) {
        if (err instanceof mongoose.Error.CastError) {
            return res.status(400).json({status: false, message: "Invalid id"})
        }
        next(err)
    }  
}
module.exports = {
    getAllArticles,
    createArticle,
    updateArticle,
    filterByDraftsOrPublished,
    updateDraftToPublished,
    getArticleByIdOrTitle,
    deleteArticle
}