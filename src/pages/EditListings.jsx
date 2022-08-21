import { useState, useEffect, useRef } from "react"
import {getAuth, onAuthStateChanged} from 'firebase/auth'
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage'
import {doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore"
import { db } from "../firebase.config"
import {v4 as uuidv4} from 'uuid'
import { useNavigate, useParams } from "react-router-dom"
import Spinner from "../components/Spinner"
import {toast} from 'react-toastify'


function EditListings() {
  const [geolocationEnabled, setGeolocationEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [listing, setListing] = useState(null)
  const [formData, setFormData] = useState({
    type: 'rent',
    name: '',
    bedrooms: 1,
    bathrooms: 1,
    parking: false,
    furnished: false,
    address: '',
    offer: false,
    regularPrice: 0,
    discountedPrice: 0,
    images: {},
    latitude: 0,
    longitude: 0
  })

  const {type, name, bedrooms, bathrooms, parking, furnished, address, offer, regularPrice, discountedPrice, images, latitude, longitude} = formData

  const auth = getAuth()
  const navigate = useNavigate()
  const params = useParams()
  const isMounted =useRef(true)

  //Redirect if lisiting is not user's listing
  useEffect(() => {
    if(listing && listing.userRef !== auth.currentUser.uid){
      toast.error('You can not edit that listing')
      navigate('/')
    }
  }, [])

  //Fetch the listing to edit
  useEffect(() => {
    setLoading(false)
    const fetchInitialListing = async () => {
      const docRef = doc(db, 'listings', params.listingId)
      const docSnap = await getDoc(docRef)

      if(docSnap.exists()){
        setListing(docSnap.data())
        setFormData({...docSnap.data(), address: docSnap.data().location})
        setLoading(false)
      }else {
        navigate('/')
        toast.error('Listing does not exist')
      }
    }

    fetchInitialListing()
  }, [params.listingId, navigate])

  //Sets useRef to logged in user
  useEffect(() => {
    if(isMounted) {
      onAuthStateChanged(auth, (user) => {
        if(user) {
          setFormData({...formData, userRef: user.uid})
        }else {
          navigate('/sign-in')
        }
      })

    }

    return () => {
      isMounted.current = false
    }
  }, [isMounted])

  const onSubmit = async (e) => {
    e.preventDefault()

    setLoading(true)

    if(discountedPrice >= regularPrice){
      setLoading(false)
       toast.error('Discounted price needs to be less than the regular price')
       return
    }

    if(images.length > 6){
      setLoading(false)
      toast.error('Max 6 images')
    }

    //creating the geocodes
    let geolocation = {}
    let location

    if(geolocationEnabled) {
      //if the geolocation is enabled and we are using the google geocoding system
      const response = await fetch(`google-geocoding-api?address=${address}&key=${process.env.REACT_APP_GEOCODE_API_KEY}`)

      const data = response.json()
 
      geolocation.lat = data.result[0]?.geometry.location.lat ?? 0
      geolocation.lng = data.result[0]?.geometry.location.lng ?? 0

      location = 
      data.status === 'ZERO_RESULTS'
      ? undefined
      : data.results[0]?.formatted_address

      if(location === undefined || location.includes('undefined')){
        setLoading(false)
        toast.error('Please enter a correct address')
        return
      }
    }else {
      //if the geolocation is not enabled and w're not using the google geocoding system
      geolocation.lat = latitude
      geolocation.lng = longitude
      location = address
    }

    //storing the images on firebase
    const storeImage = async (image) => {
      return new Promise((resolve, reject) => {
        //firstly we have to initialize storage
        const storage = getStorage()

        //Then creating our file name
        const fileName = `${auth.currentUser.uid}-${image.name}-${uuidv4()}`

        //Then we need to create a storage reference
        const storageRef = ref(storage, 'images/'+fileName)

        //then we need to create an upload task
        const uploadTask = uploadBytesResumable(storageRef, image)

        //then uploading the image func to the firebase storage
        uploadTask.on('state_changed', 
       (snapshot) => {
       const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
       console.log('Upload is ' + progress + '% done');
       switch (snapshot.state) {
       case 'paused':
        console.log('Upload is paused');
        break;
       case 'running':
        console.log('Upload is running');
        break;
      }
      }, 
      (error) => {
        // Handle unsuccessful uploads
         reject(error)
        }, 
      () => {
        // Handle successful uploads on complete
        // For instance, get the download URL: https://firebasestorage.googleapis.com/...
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
        resolve(downloadURL);
        });
      }
      )
      })
    }

    //resolving all the promise that is been returned
    const imageUrls = await Promise.all(
      [...images].map((image) => storeImage(image))
    ).catch(() => {
      setLoading(false)
      toast.error('Images not upLoaded')
      return
    })

    //creating an object to submit to the database
    const formDataCopy = {
      ...formData,
      imageUrls,
      geolocation,
      timestamp: serverTimestamp()
    }

    delete formDataCopy.images
    delete formDataCopy.address
    location && (formDataCopy.location = location)
    !formDataCopy.offer && delete formDataCopy.discountedPrice

    //we are updating the edit listing 
    const docRef = doc(db, 'listings', params.listingId)
    await updateDoc(docRef, formDataCopy)
    setLoading(false)
    toast.success('Listings saved')
    //then navigating to our new lisings
    navigate(`/category/${formDataCopy.type}/${docRef.id}`)

    setLoading(false)

  }

  const onMutate = (e) => {
    let boolean = null
    //since the boolean values will come in as a string resetting them to booleans
    if(e.target.value === 'true'){
      boolean = true
    }
    //Also for false
    if(e.target.value === 'false'){
      boolean = false
    }

    //Files
    if(e.target.files){
      setFormData((prevState) => ({
        ...prevState,
        images: e.target.files 
      }))
    }

    //Text/Boolean/numbers
    if(!e.target.files){
      setFormData((prevState) => ({
        ...prevState,
        [e.target.id]: boolean ?? e.target.value,
      }))
    }

  }

  if(loading){
    return <Spinner />
  }


  return <div className="profile">
    <header>
      <p className="pageHeader">
        Edit Listing
      </p>
    </header>

    <main>
      <form onSubmit={onSubmit}>
        <label htmlFor="type" className="formLabel">Sell / Rent</label>
        <div className="formBttons">
          <button 
          type="button"
          className={type ==='sale' ? 'formButtonActive' : 'formButton'}
          id='type'
          value='sale'
          onClick={onMutate}>
            Sell
          </button>

          <button 
          type="button"
          className={type ==='rent' ? 'formButtonActive' : 'formButton'}
          id='type'
          value='rent'
          onClick={onMutate}>
            Rent
          </button>
        </div>

        <label htmlFor="name" className="formLabel">Name</label>
        <input 
        type="text" 
        className="formInputName"
        id="name"
        value={name}
        onChange={onMutate}
        maxLength="32"
        minLength="10"
        required />

      <div className="formRooms flex">
        <div>
          <label htmlFor="bedrooms" className="formLabel">Bedrooms</label>
          <input 
          type="number" 
          className="formInputSmall"
          id="bedrooms"
          value={bedrooms}
          onChange={onMutate}
          min='1'
          max='50'
          required />
        </div>
        <div>
          <label htmlFor="bathrooms" className="formLabel">Bathrooms</label>
          <input 
          type="number" 
          className="formInputSmall"
          id="bathrooms"
          value={bathrooms}
          onChange={onMutate}
          min='1'
          max='50'
          required />
        </div>
      </div>

      <label htmlFor="parking" className="formLabel">
        Parking spot
      </label>
      <div className="formButtons">
        <button 
        type="button"
        className={parking ? 'formButtonActive': 'formButton'}
        id="parking"
        value={true}
        onClick={onMutate}
        min='1'
        max='50'>
           Yes
        </button>

        <button 
        type="button"
        className={!
          parking && parking !== null ? 'formButtonActive': 'formButton'}
        id="parking"
        value={false}
        onClick={onMutate}>
           No
        </button>
      </div>

      <label htmlFor="parking" className="formLabel">
        Furnished
      </label>
      <div className="formButtons">
        <button 
        type="button"
        className={furnished ? 'formButtonActive': 'formButton'}
        id="furnished"
        value={true}
        onClick={onMutate}
        min='1'
        max='50'>
           Yes
        </button>

        <button 
        type="button"
        className={!
          furnished && furnished !== null ? 'formButtonActive': 'formButton'}
        id="parking"
        value={false}
        onClick={onMutate}>
           No
        </button>
      </div>

      <label htmlFor="address" className="formLabel">Address</label>
      <textarea
      className="formInputAddress"
      type='text'
      id="address"
      value={address}
      onChange={onMutate}
      required
      />

      {!geolocationEnabled && (
        <div className="formLating flex">
          <div>
            <label htmlFor="latitude" className="formLabel">Latitude</label>
            <input type="number" className="formInputSmall"
            id='latitude'
            value={latitude}
            onChange={onMutate}
            required
           />
          </div>
          <div>
            <label htmlFor="longitude" className="formLabel">Longitude</label>
            <input type="number" className="formInputSmall"
            id="longitude"
            value={longitude}
            onChange={onMutate}
            required
            />
          </div>
        </div>
      )}

      <label htmlFor="offer" className="formLabel">Offer</label>
      <div className="formButtons">
        <button 
        className={offer ? 'formButtonActive' : 'formButton'}
        type='button'
        id='offer'
        value={true}
        onClick={onMutate}
        >
          Yes
        </button>
        <button 
        className={!offer && offer !==null ? 'formButtonActive' : 'formButton'}
        type='button'
        id='offer'
        value={false}
        onClick={onMutate}
        >
          No
        </button>
      </div>

      <label htmlFor="regularPrice" className="formLabel">Regular Price</label>
      <div className="formPriceDiv">
        <input type="number" className="formInputSmall"
        id="regularPrice"
        value={regularPrice}
        onChange={onMutate}
        min='50'
        max='750000000'
        required 
        />
        {formData.type === 'rent' && (
          <p className="formPriceText">$ / Month</p>
        )}
      </div>

      {offer && (
        <>
        <label htmlFor="discountedPrice" className="formLabel">Discounted Price</label>
        <input type="number" className="formInputSmall"
        id="discountedPrice"
        value={discountedPrice}
        onChange={onMutate}
        min='50'
        max='750000000'
        required={offer} 
        />
        </>
      )}

      <label htmlFor="images" className="formLabel">Images</label>
      <p className="imagesInfo">The first image will be the cover (max 6).</p>
      <input 
      type="file" 
      className="formInputFile"
      id="images"
      onChange={onMutate}
      max='6'
      accept='.jpg,.png,.jpeg'
      multiple
      required 
      />
      <button className="primaryButton createListingButton"
      type="submit">Edit Listings</button>
    </form>
    </main>
  </div>
}

export default EditListings