---
draft: false
title: 'Using the Interactive Search Toolbox'
---

*This page is under construction!*

This page has multiple sections. If you are completely new to jsPsych or the concept of virtual 3D environments then we recommend reading through the basics section.

If you are comfortable with these tools, then skip to the Tutorial Guide and Examples section for some basic guides on how to use the Interactive Search Toolbox!

## The Basics
In this section we have provided some basic information that may help you make the most out of the Interactive Search Toolbox and its associated templates.
First, we discuss some key aspects of jsPsych and how we recommend integrating the Interactive Search Toolbox into it's flow.
Following this, we discuss the **animation loop** before finally a very brief overview of 2D, 3D graphics.

### Integration into jsPsych
To use the Interactive Search Toolbox to its full potential, it should be integrated into jsPsych's timeline and plugin architecture.
But what exactly do we mean by this?

#### Timelines
jsPsych works by running predetermined **trial objects** within specified timelines.
In other words, a timeline is an ordered set of trials that describes the structure of the experiment.

![Experiment Timeline](/searchLab/images/Timeline.png)

Within code this might look something like this...
```js
const timeline = [instruction_trial, fixation_trial, search_trial, debrief_trial]
jsPsych.run(timeline)
```

#### Trial Objects
A trial object is simply a [JavaScript object](https://www.w3schools.com/js/js_objects.asp) used to configure what type of trial jsPsych should run.
There are numerous different **types** of trials that you can use depending on your requirements (jsPsych calls these [plugins](https://www.jspsych.org/latest/overview/plugins/)).

Every trial object in jsPsych has built in ``on_load()``, ``on_start()``, and ``on_finish()`` methods that the Interactive Search Toolbox will regularly make use of.
```js
const trial = {
    type: jsPsychHtmlKeyboardResponse, // Trial type (plugins)
    on_start(): function(){
        console.log("I am called when the trial first starts!")
    }
    stimulus: '<p">Hello world!</p>', // This will be displayed to the participant during the trial.
    choices: ['Z', 'M'], // This is the keys they press to respond.
    on_finish(): function(){
        console.log("I am called after the trial finishes!")
    }
};
```



#### Preloading
Before we even consider building a trial we should preload all stimuli and textures that that we plan to use within the experiment.
Due to the asynchronous nature of web browsers, we recommend you do this before you do anything else. The Interactive Search Toolbox has built-in tools for this.
* ``IST.preLoadModels(models = [])``
* ``IST.preLoadTextures(textures = [])``
* ``IST.preLoadHDRI([],applyToScene = false)``


The Interactive Search Toolbox needs to utilise the built-in ``on_start()``, and ``on_finish()`` methods that come built-in to each jsPsych trial object to run smoothly via the following straightforward structure:

1. When the trial starts (``on_start()``), the stimuli and anything else needed for the trial, are “setup” and the ``IST.startTrial()`` method is called.
2. The trial begins, the participant is allowed to interact, and interactive data is collected.
3. After the trial ends (``on_finish()``), the stimuli are cleared from the screen and any collected data is saved by calling the ``IST.endTrial()`` method.
4. Steps 1-3 are then repeated until the experiment is complete and the final data downloaded.

![Trial Setup/Cleanup](/searchLab/images/prepostTrial.png)

### The Animation Loop
The animation loop (sometimes called a game loop) is the heartbeat of any interactive application. It is simply a block of code that repeatedly runs over and over until it is told to stop.

The rate at which this happens is often tied to the refresh rate of the screen. For simplicty sake, we will assume that this is 60Hz. That is, the code included within the animation loop will be executed 60 times every second. 

![Animation Loop](/searchLab/images/AnimationLoop.png)

#### Animations and Interactions
So why is this loop important?

By including code that listens for user input (e.g., mouse movements and key presses) and then updates what is displayed on the screen within this loop, smooth animation and real-time interaction can occur.

This may feel somewhat abstract, so envision a screen that is displaying a red arrow. In the animation loop, code is executed that draws this red arrow on the screen, then, at the end of the loop, code is executed that removes the arrow from the screen. 

![Animation Loop](/searchLab/images/ArrowDrawnSmall.gif)

This happens 60 times per second (This happens so fast that we no longer perceive the clearing part of the process).

![Animation Loop](/searchLab/images/ArrowTimeSmall.gif)

Now, if we include further code that takes the position of the cursor and calculates its direction from the arrow, then we can make the arrow point in the direction of the cursor! By doing so, we've just implemented interaction into the design!

![Animation Loop](/searchLab/images/ArrowMovementSmall.gif)

Remember, this code is running repeatedly with each screen refresh (every ~16ms for 60Hz).

If all of the code within the animation loop can execute **quicker** than the time it takes to refresh the screen, then the movements and interactions will be perceived as smooth and real-time. If it takes longer, then it will feel laggy/choppy.

#### Capturing Data in the Loop
Finally, if we keep track of everything within the display (e.g., current arrow position and direction) and any user inputs (e.g., mouse movement, button presses etc.), then we can easily inspect and recreate displays and interactions after the fact.

### 2D/3D Graphics
If you have experience with any type of 3D modelling software or game development tools then skip ahead to the Examples section. If not, we will now break down some fundamentals of computer graphics to hopefully save you some headaches when using the Interactive Search Toolbox.

#### Canvas
For both 2D and 3D graphics, the computer must "draw" (render) colours and shapes on the display. To do so, it must have a "surface" to draw on. HTML provides a specific and specialised element for this known as a [canvas](https://www.w3schools.com/html/html5_canvas.asp) element.

By utlising the canvas element, graphics can be easily rendered within web pages. 

* Note that all rendering of graphics within the Interactive Search Toolbox is handled by the extremely powerful and lightweight [Three.js](https://threejs.org/) library.

#### Cartesian Systems
In both 2D and 3D graphics the computer must know where to draw objects on the screen.
A common way to do this is to use caretesian coordinates.

Cartesian coordinates are a way of describing positions in space using perpendicular axes.
For 2D graphics we use X and Y axes. Or in simple English, axes that describe left to right (X), and up and down (Y). For 3D graphics, however, we need to include an additional Z axis (front-to-back).

Any point in this virtual space is defined by three numbers, written as (X, Y, Z), which tell you how far to move along each axis from the origin (0, 0, 0).

![Cartesian Coordinates](/searchLab/images/cartesianGifSmall.gif)

#### Scenes, Virtual Cameras, Lights, and Objects
There are four key facets that need to be understood when creating 3D environments.

The first of these are scenes. A scene is simply a container that holds all the contents of your 3D environment.
In a typical interactive search task this would include a virtual camera, some lights, and your stimuli in the form of 3D objects.

![3D Scenes](/searchLab/images/3dSceneSmall.gif)

A virtual camera is a representation of the 3D environment from a specific viewpoint. It acts like a real-world camera, dictating what parts of the 3D environment are rendered onto the canvas based on its position, orientation, and lens settings.

Virtual lighting refers to virtual sources of light added into the 3D environemnt. These lights determine how 3D objects are shaded, colored, and how they cast shadows. There are several different types of lights available but two common ones are point lights and directional lights. A common mistake is forgetting to include a form of lighting within your 3D environment, making it seem that there is nothing within the scene.
![Lighting](/searchLab/images/lightingGifSmall.gif)
* Note that the Interactive Search Toolbox can also employ [HDRI environments](https://polyhaven.com/hdris) for lighting via the ``IST.preLoadHDRI([],applyToScene = false)`` function.  

Finally, a 3D object refers to any entity that is placed within a 3D scene. Every object has some basic spatial properties (position, rotation, scale) that allow us to manipulate where an object is placed within the 3D environment, its size, and its orientation. In addition to this, there are many other attributes that come packed into 3D objects by default (e.g., the name attribute). Detailed explanation on 3D objects can be found [here](https://threejs.org/docs/#Object3D). However, for the sake of the Interactive Search Toolbox, 3D objects mostly refer to the stimuli you wish to add to the scene and use in your experiment.

## Tutorial Guide and Examples
In this section we will detail some basic examples for using the Interactive Search Toolbox. 
You can download the demos and their associated files <a href="/searchLab/demos/AllExamples.zip" download>here</a>.

Unzip the downloaded file and host the folder in any local server of your choosing. Following this, open any of the associated demo html files through your server e.g., ``localhost:3000/hello_world.html`` - they are all self contained.

We will run through one demo in detail and the rest can be inspected at your own pace. Files are well documented with comments and the same approach used in the first tutorial can be applied to all of the remaining examples.

### Hello World!
We will begin with a basic hello world tutorial where you will install the Interactive Search Toolbox, preload a model, and create a basic trial that displays that 3D model to the participant. 

This same approach is then applied to all of the remaining examples.

<a href="/searchLab/demos/hello_world.html" target="_blank">You can run the demo immediately by clicking here!</a>

1. We begin by including the Interactive Search Toolbox into your application. The easiest approach is to include the library and its associated css file via a CDN (content delivery network) link.
After this you will need to include a script tag inside the body element of your HTML document. 
You can either write your javascript code directly between these tags or use a separate file instead.  
```html
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Search Task</title>
    
    <!-- Interactive Search Toolbox -->
    <script src="https://cdn.jsdelivr.net/gh/InteractiveSearchToolbox/IST@v1.0.0/build/IST.min.js"></script>
    <link href="https://cdn.jsdelivr.net/gh/InteractiveSearchToolbox/IST@v1.0.0/build/IST.min.css" rel="stylesheet" type="text/css" />
    <!------------------------------------------------------------------------------------------------------------------------------->
</head>

<body>
    <!-- Link to your javascript file -->
    <script src = 'main.js' type="module"></script>
</body>
</html>
```

2. The first thing we do inside our javascript code is create a new instance of the toolbox. This sets up the toolbox and provides us with everything we need to create our experiment.

```js
// New instance of the toolbox.
const IST = new InteractiveSearchToolbox({ enableAmbientLighting: true })
```

3. Next, we preload the 3D models we want to use. Here, we are preloading a 3D model in glb format called HelloWorld. 
```js
// Preload all models here.
IST.preLoadModels(['Models/HelloWorld.glb'])
```

4. Due to the asynchronous nature of web browsers, we need to wait until our 3D HelloWorld model has fully loaded before we can do anything with it. We use the IST.onPreloadFinished() callback to do so.

```js
// Wrap remaining code in the onPreloadFinished function.
IST.onPreloadFinished(function () {

});

```

5. We place all remaining code inside the ``IST.onPreloadFinished()`` callback. Here, we have created two trials. An instruction trial, and a search trial. When the search trial starts (``on_start()``) we find our loaded object using the IST.findLoadedObject(name) function, then we add it to our scene, and call the ``IST.startTrial()`` function. Once the trial ends (``on_finish()``) we call the ``IST.endTrial()`` function to clean up the scene and save any associated data. Finally, the whole experiment is then started by calling ``jsPsych.run(timeline)``.
```js
// Wrap remaining code in the onPreloadFinished function.
IST.onPreloadFinished(function () {
    // Instruction trial is where we would provide instructions on how to complete the experiment.
    const INSTRUCTION_TRIAL = {
        type: htmlButtonResponse,
        on_start() {
        },
        stimulus: `
                <h3>Welcome!</h3>
                When you are ready to start, press the button below!
                `,
        on_finish(data) {
        },
        choices: ['Start Experiment']
    }

    const SEARCH_TRIAL = {
        type: htmlKeyboardResponse,
        on_start() {
            let object = IST.findLoadedObject('HelloWorld')
            IST.addStimulusToScene(object);

            IST.camera.position.z = 50;
            IST.startTrial(); // We call this to start the trial - This is extremely important.
        },
        stimulus: '', // We tell jspsych not to show anything for the trial, we handle that with the IST instead. 
        on_finish() {
            IST.endTrial(); // Call this at the end of every trial - This is extremely important. 
        },
        choices: ['z', 'm']
    }

    jsPsych.run([INSTRUCTION_TRIAL, SEARCH_TRIAL])
}
);

```

6. Full code...
```html
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Search Toolbox</title>
    <script src="https://cdn.jsdelivr.net/gh/InteractiveSearchToolbox/IST@v1.0.0/build/IST.min.js"></script>
    <link href="https://cdn.jsdelivr.net/gh/InteractiveSearchToolbox/IST@v1.0.0/build/IST.min.css" rel="stylesheet"
        type="text/css" />
</head>

<body>
    <script type="module">
        // UPLOADING AND DISPLAYING YOUR FIRST OBJECT 

        // New instance of the toolbox.
        const IST = new InteractiveSearchToolbox({ enableAmbientLighting: true })

        // Preload all models here.
        IST.preLoadModels(['Models/HelloWorld.glb'])

        // Wrap remaining code in the onPreloadFinished callback.
        IST.onPreloadFinished(function () {

            // Instruction trial is where we would provide instructions on how to complete the experiment.
            const INSTRUCTION_TRIAL = {
                type: htmlButtonResponse,
                on_start() {
                },
                stimulus: `
                <h3>Welcome!</h3>
                When you are ready to start, press the button below!
                `,
                on_finish(data) {
                },
                choices: ['Start Experiment']
            }

            const SEARCH_TRIAL = {
                type: htmlKeyboardResponse,
                on_start() {
                    let object = IST.findLoadedObject('HelloWorld')
                    IST.addStimulusToScene(object);

                    IST.camera.position.z = 50;
                    IST.startTrial(); // We call this to start the trial - This is extremely important.
                },
                stimulus: '', // We tell jspsych not to show anything for the trial, we handle that with the IST instead. 
                on_finish() {
                    IST.endTrial(); // Call this at the end of every trial - This is extremely important. 
                },
                choices: ['z', 'm']
            }

            jsPsych.run([INSTRUCTION_TRIAL,SEARCH_TRIAL])
        }
        );
    </script>
</body>

</html>
```

### Interactive Controls
What it is

<a href="/searchLab/demos/interactive_controls_example.html" target="_blank">Demo in browser</a>

### Placing Stimuli Randomly
What it is

<a href="/searchLab/demos/placing_stimuli_randomly.html" target="_blank">Demo in browser</a>

### Placing Stimuli Using Grids
What it is

<a href="/searchLab/demos/placing_stimuli_using_grids.html" target="_blank">Demo in browser</a>

### Using the Cursor Callbacks
What it is

<a href="/searchLab/demos/using_the_cursor_callbacks.html" target="_blank">Demo in browser</a>


### Using the Update Callback
What it is

<a href="/searchLab/demos/using_the_update_loop.html" target="_blank">Demo in browser</a>
