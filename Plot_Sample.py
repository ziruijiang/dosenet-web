#!/usr/bin/python3
from collections import deque
import ast
#from globalvalues import DEFAULT_DATALOG_D3S
import numpy as np
import os
import matplotlib
#matplotlib.use("Qt5Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import axes3d
from matplotlib.collections import PolyCollection
from matplotlib.colors import colorConverter
from multiprocessing import Process




def grab_data(i):
    """
    Takes data from datalog and places it in a queue. Rebin data here.
    """
    with open('testdata.txt','r') as f:
        data = f.read()
    data = ast.literal_eval(data)
    queue_t= deque('')
    queue = deque('')
    line = 0
    for j in data:
        new_data = rebin(np.array(j))
        queue_t.append(new_data)
    while (line<=i):
        queue.append(queue_t[line])
        line+=1
    return queue

    


# In[2]:

def sum_data(data):
    """
    Sums up the data in the queue
    """
    total = data.popleft()
    i = 1
    while i < len(data):
        total += data.popleft()
        i+=1
    return total



# In[3]:

def plot_data(data):
    """
    Plots data
    """

    plt.xlabel('Channel')
    plt.ylabel('Counts')
    x = np.linspace(0, 4096, 256)
    plt.plot(x, data, drawstyle='steps-mid')
   
    #plt.show()
    plt.pause(0.6)



def rebin(data, n=4):
    """
    Rebins the array. n is the divisor. Rebin the data in the grab_data method. 
    """
    a = len(data)/n
    new_data = np.zeros((256, 1))
    i = 0 
    count = 0
    while i < a:
        temp = sum(data[i:n*(count+1)])
        new_data[count] = temp
        count+=1
        i+=n
    return new_data



def make_image(queue):
    """
    Prepares an array for the waterfall plot
    """
    length = len(queue)
    
    image = np.zeros((length, 256))
    i = 0 
    while i < length:
        image[i]=fix_array(queue.popleft())
        i+=1
    return image
    


def fix_array(array):
    """
    Used to format arrays for the waterfall plot. 
    """
    new_array = np.zeros((256))
    i = 0
    while i < 256:
        new_array[i] = array[i]
        i+=1
    return new_array
        



def sum_graph():
    """
    Plots the sum of all the spectra
    """
    #matplotlib.use("TkAgg")
    # x = tk.Tk().winfo_screenwidth()
    # y = tk.Tk().winfo_screenheight()
    #matplotlib.use("Qt4Agg")
    
    # mgr = plt.get_current_fig_manager()
    # mgr.full_screen_toggle() 
    # py = mgr.canvas.height()
    # px = mgr.canvas.width()
    # mgr.window.setGeometry(0.1*px, 0.3*py, 0.4*px, 0.5*py)
    plt.ion()
    i=1
    while (i<9):
        queue = grab_data(i)
        total = sum_data(queue)
        plt.clf()
        plot_data(total)
        print ('line',i)
        i+=1
        plt.pause(0.7)
        
    while True:
        plt.pause(0.7)


        
def waterfall_graph():
    """
    Plots a waterfall graph of all the spectra. Just needs to test with actual data
    """
    # matplotlib.use("TkAgg")
    # x = tk.Tk().winfo_screenwidth()
    # y = tk.Tk().winfo_screenheight()
    #matplotlib.use("Qt4Agg")
    
    # mgr = plt.get_current_fig_manager()
    # mgr.full_screen_toggle() 
    # py = mgr.canvas.height()
    # px = mgr.canvas.width()
    
    plt.ion()
    i=1
    while (i<9):
        print ('line',i)
        queue = grab_data(i)
        queue_length = len(queue)
        image = make_image(queue)
        

        plt.clf()

        i+=1

        #mgr.window.setGeometry(0.5*px,0.3*py, 0.4*px, 0.5*py)
        plt.imshow(image, interpolation='nearest', aspect='auto', cmap=plt.get_cmap('jet'), extent=[1,4096,queue_length,1])
        plt.xlabel('Bin')

        plt.ylabel('Spectra')
        plt.colorbar()
        plt.show()
        plt.pause(0.7)
    while True:
        plt.pause(0.7)


    
if __name__ == '__main__':      
    p1 = Process(target=sum_graph)
    p1.start()
    p2 = Process(target=waterfall_graph)
    p2.start()
    p1.join()
    p2.join()



